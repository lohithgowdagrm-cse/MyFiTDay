from datetime import date, timedelta, datetime
from io import BytesIO
from zipfile import ZipFile, ZIP_DEFLATED

from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.db import transaction
from django.http import HttpResponse

from rest_framework import status, viewsets
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .models import (
    Exercise,
    WorkoutPlan,
    WorkoutExercise,
    WorkoutSession,
    ExerciseLog,
    UserGoal,
    ProgressPhoto,
)

from .serializers import (
    RegisterSerializer,
    UserSerializer,
    ExerciseSerializer,
    WorkoutPlanSerializer,
    WorkoutSessionSerializer,
    GoalSerializer,
    ProgressPhotoSerializer,
)

from .services import weekly_summary, coach, wger_exercises


# ============================================================
# AUTHENTICATION
# ============================================================

@api_view(["POST"])
@permission_classes([AllowAny])
def register(request):
    serializer = RegisterSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    user = serializer.save()

    Token.objects.create(user=user)
    UserGoal.objects.create(user=user)

    seed_user_plan(user)

    return Response(
        {
            "token": user.auth_token.key,
            "user": UserSerializer(user).data,
        },
        status=status.HTTP_201_CREATED,
    )


@api_view(["POST"])
@permission_classes([AllowAny])
def login(request):
    user = authenticate(
        username=request.data.get("username", ""),
        password=request.data.get("password", ""),
    )

    if not user:
        return Response(
            {"detail": "Invalid username or password."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    token, _ = Token.objects.get_or_create(user=user)
    UserGoal.objects.get_or_create(user=user)

    return Response(
        {
            "token": token.key,
            "user": UserSerializer(user).data,
        }
    )


@api_view(["GET"])
def me(request):
    return Response(UserSerializer(request.user).data)


# ============================================================
# WORKOUTS
# ============================================================

class WorkoutPlanViewSet(viewsets.ModelViewSet):
    serializer_class = WorkoutPlanSerializer

    def get_queryset(self):
        return (
            WorkoutPlan.objects
            .filter(user=self.request.user)
            .prefetch_related("exercises__exercise")
        )

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=True, methods=["post"], url_path="exercises")
    def add_exercise(self, request, pk=None):
        workout = self.get_object()

        name = str(request.data.get("name", "")).strip()

        if not name:
            return Response(
                {"detail": "Exercise name is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        exercise, _ = Exercise.objects.get_or_create(
            name=name,
            defaults={"source": "custom"},
        )

        item = WorkoutExercise.objects.create(
            workout=workout,
            exercise=exercise,
            position=workout.exercises.count(),
            sets=int(request.data.get("sets", 3)),
            reps=int(request.data.get("reps", 10)),
            weight_kg=request.data.get("weight_kg", 0),
            calories_per_set=request.data.get("calories_per_set", 0.55),
        )

        return Response(
            WorkoutPlanSerializer(workout).data,
            status=status.HTTP_201_CREATED,
        )

    @action(
        detail=True,
        methods=["patch"],
        url_path=r"exercises/(?P<exercise_id>[^/.]+)",
    )
    def update_exercise(self, request, pk=None, exercise_id=None):
        workout = self.get_object()

        item = workout.exercises.get(id=exercise_id)

        for key in (
            "sets",
            "reps",
            "weight_kg",
            "calories_per_set",
            "position",
        ):
            if key in request.data:
                setattr(item, key, request.data[key])

        if "name" in request.data:
            item.exercise.name = str(request.data["name"]).strip()
            item.exercise.save(update_fields=["name"])

        item.save()

        return Response(
            WorkoutPlanSerializer(workout).data
        )

    @action(
        detail=True,
        methods=["delete"],
        url_path=r"exercises/(?P<exercise_id>[^/.]+)",
    )
    def delete_exercise(self, request, pk=None, exercise_id=None):
        workout = self.get_object()

        workout.exercises.filter(id=exercise_id).delete()

        return Response(status=status.HTTP_204_NO_CONTENT)


# ============================================================
# WORKOUT SESSIONS
# ============================================================

class SessionViewSet(viewsets.ModelViewSet):
    serializer_class = WorkoutSessionSerializer

    def get_queryset(self):
        return (
            WorkoutSession.objects
            .filter(user=self.request.user)
            .prefetch_related("logs")
        )

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


# ============================================================
# GOALS
# ============================================================

class GoalViewSet(viewsets.ModelViewSet):
    serializer_class = GoalSerializer

    def get_queryset(self):
        return UserGoal.objects.filter(user=self.request.user)

    def create(self, request, *args, **kwargs):
        weekly_target = int(
            request.data.get("weekly_calorie_target", 2500)
        )

        obj, _ = UserGoal.objects.update_or_create(
            user=request.user,
            defaults={
                "weekly_calorie_target": weekly_target,
            },
        )

        return Response(self.get_serializer(obj).data)


# ============================================================
# PROGRESS PHOTOS
# ============================================================

class PhotoViewSet(viewsets.ModelViewSet):
    serializer_class = ProgressPhotoSerializer
    parser_classes = [MultiPartParser, FormParser]

    def get_queryset(self):
        return ProgressPhoto.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


# ============================================================
# EXERCISES
# ============================================================

class ExerciseViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = ExerciseSerializer

    def get_queryset(self):
        return Exercise.objects.all()


# ============================================================
# DASHBOARD / AI
# ============================================================

@api_view(["GET"])
def summary(request):
    return Response(
        weekly_summary(request.user)
    )


@api_view(["POST"])
def ai_coach(request):
    return Response(
        coach(
            weekly_summary(request.user),
            request.data.get("prompt", ""),
        )
    )


@api_view(["GET"])
def wger_search(request):
    try:
        return Response(
            wger_exercises(
                request.query_params.get("search", "")
            )
        )
    except Exception as exc:
        return Response(
            {"detail": f"Wger unavailable: {exc}"},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )


# ============================================================
# PHOTO EXPORT
# ============================================================

@api_view(["GET"])
def export_photos(request):
    range_name = request.query_params.get("range", "day")
    anchor_text = request.query_params.get("date")

    try:
        anchor = (
            datetime.strptime(anchor_text, "%Y-%m-%d").date()
            if anchor_text
            else date.today()
        )
    except ValueError:
        anchor = date.today()

    if range_name == "week":
        start = anchor - timedelta(days=anchor.weekday())
        end = start + timedelta(days=6)

    elif range_name == "month":
        start = anchor.replace(day=1)

        next_month = (
            (start.replace(day=28) + timedelta(days=4))
            .replace(day=1)
        )

        end = next_month - timedelta(days=1)

    else:
        start = end = anchor

    photos = ProgressPhoto.objects.filter(
        user=request.user,
        captured_at__date__range=(start, end),
    )

    buf = BytesIO()

    with ZipFile(buf, "w", ZIP_DEFLATED) as archive:

        for photo in photos:

            if (
                photo.image
                and photo.image.storage.exists(photo.image.name)
            ):
                with photo.image.storage.open(
                    photo.image.name,
                    "rb",
                ) as handle:

                    archive.writestr(
                        photo.image.name.split("/")[-1],
                        handle.read(),
                    )

    response = HttpResponse(
        buf.getvalue(),
        content_type="application/zip",
    )

    response["Content-Disposition"] = (
        f'attachment; filename="myfitday-{range_name}-{start.isoformat()}.zip"'
    )

    return response


# ============================================================
# TOGGLE TODAY'S EXERCISE
# ============================================================

@api_view(["POST"])
def toggle_today_exercise(request):
    """
    Toggle completion of an exercise for a specific workout session.

    Expected request body:

    {
        "workout_exercise_id": 7,
        "completed": true,
        "date": "2026-08-15"
    }

    If date is omitted, today's date is used.
    """

    workout_exercise_id = request.data.get(
        "workout_exercise_id"
    )

    completed = bool(
        request.data.get("completed", False)
    )

    # --------------------------------------------------------
    # Validate workout exercise
    # --------------------------------------------------------

    if not workout_exercise_id:
        return Response(
            {
                "detail": "workout_exercise_id is required."
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        item = (
            WorkoutExercise.objects
            .select_related("workout")
            .get(
                id=workout_exercise_id,
                workout__user=request.user,
            )
        )

    except WorkoutExercise.DoesNotExist:
        return Response(
            {
                "detail": "Workout exercise not found."
            },
            status=status.HTTP_404_NOT_FOUND,
        )

    # --------------------------------------------------------
    # Determine session date
    # --------------------------------------------------------

    requested_date = (
        request.data.get("date")
        or date.today().isoformat()
    )

    try:
        session_date = datetime.strptime(
            requested_date,
            "%Y-%m-%d",
        ).date()

    except (ValueError, TypeError):
        session_date = date.today()

    # --------------------------------------------------------
    # Get or create today's workout session
    # --------------------------------------------------------

    session, _ = WorkoutSession.objects.get_or_create(
        user=request.user,
        workout=item.workout,
        date=session_date,
        defaults={
            "duration_minutes": item.workout.duration_minutes
        },
    )

    # --------------------------------------------------------
    # Get or create exercise log
    # --------------------------------------------------------

    log, _ = ExerciseLog.objects.get_or_create(
        session=session,
        workout_exercise=item,
    )

    # --------------------------------------------------------
    # Update exercise completion
    # --------------------------------------------------------

    log.completed = completed

    log.sets_completed = (
        item.sets
        if completed
        else 0
    )

    log.reps_completed = (
        item.reps
        if completed
        else 0
    )

    log.weight_kg = item.weight_kg

    log.save()

    # --------------------------------------------------------
    # Calculate workout progress
    # --------------------------------------------------------

    total = item.workout.exercises.count()

    done = session.logs.filter(
        completed=True
    ).count()

    progress = (
        round(done / total * 100)
        if total
        else 0
    )

    # --------------------------------------------------------
    # Mark entire workout complete if all exercises done
    # --------------------------------------------------------

    session.completed = (
        total > 0
        and done == total
    )

    session.save(
        update_fields=["completed"]
    )

    # --------------------------------------------------------
    # Return result to React
    # --------------------------------------------------------

    return Response(
        {
            "completed": completed,
            "progress": progress,
            "session_id": session.id,
        }
    )


# ============================================================
# TOGGLE EXISTING EXERCISE LOG
# ============================================================

@api_view(["POST"])
def toggle_exercise(request, exercise_log_id):

    try:
        log = ExerciseLog.objects.get(
            id=exercise_log_id,
            session__user=request.user,
        )

    except ExerciseLog.DoesNotExist:
        return Response(
            {"detail": "Not found"},
            status=status.HTTP_404_NOT_FOUND,
        )

    completed = request.data.get(
        "completed",
        not log.completed,
    )

    log.completed = bool(completed)

    log.save(
        update_fields=["completed"]
    )

    return Response(
        {
            "completed": log.completed
        }
    )


# ============================================================
# SEED DEFAULT WORKOUT PLAN
# ============================================================

def seed_user_plan(user):

    defaults = {
        1: (
            "Push",
            [
                ("Bench Press", 4, 10, 70),
                ("Incline Dumbbell Press", 3, 12, 24),
                ("Cable Fly", 3, 12, 20),
                ("Tricep Pushdown", 3, 12, 25),
            ],
        ),

        2: (
            "Legs",
            [
                ("Squat", 4, 8, 80),
                ("Romanian Deadlift", 3, 10, 70),
                ("Leg Press", 3, 12, 120),
                ("Leg Curl", 3, 12, 35),
            ],
        ),

        3: (
            "Recovery",
            [],
        ),

        4: (
            "Pull",
            [
                ("Lat Pulldown", 4, 10, 55),
                ("Seated Cable Row", 3, 12, 50),
                ("Face Pull", 3, 15, 20),
                ("Dumbbell Curl", 3, 12, 12),
            ],
        ),

        5: (
            "Shoulders",
            [
                ("Overhead Press", 4, 8, 35),
                ("Lateral Raise", 3, 15, 10),
                ("Chest Press", 3, 10, 55),
            ],
        ),

        6: (
            "Full Body",
            [
                ("Deadlift", 3, 5, 100),
                ("Bulgarian Split Squat", 3, 10, 20),
                ("Calf Raise", 4, 15, 40),
            ],
        ),

        7: (
            "Recovery",
            [],
        ),
    }

    with transaction.atomic():

        for day, (name, items) in defaults.items():

            plan = WorkoutPlan.objects.create(
                user=user,
                day_of_week=day,
                name=name,
                duration_minutes=45 if items else 0,
                is_rest_day=not items,
            )

            for position, (
                exercise_name,
                sets,
                reps,
                weight,
            ) in enumerate(items):

                exercise, _ = Exercise.objects.get_or_create(
                    name=exercise_name,
                    defaults={
                        "source": "seed"
                    },
                )

                WorkoutExercise.objects.create(
                    workout=plan,
                    exercise=exercise,
                    position=position,
                    sets=sets,
                    reps=reps,
                    weight_kg=weight,
                    calories_per_set=0.55,
                )