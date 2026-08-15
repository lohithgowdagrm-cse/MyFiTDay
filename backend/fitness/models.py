from django.conf import settings
from django.db import models

class WorkoutPlan(models.Model):
    DAYS = [(i, n) for i, n in enumerate(['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'], start=1)]
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='workout_plans')
    day_of_week = models.PositiveSmallIntegerField(choices=DAYS)
    name = models.CharField(max_length=120, blank=True)
    duration_minutes = models.PositiveIntegerField(default=0)
    is_rest_day = models.BooleanField(default=False)
    class Meta:
        constraints = [models.UniqueConstraint(fields=['user','day_of_week'], name='unique_user_workout_day')]
        ordering = ['day_of_week']

class Exercise(models.Model):
    name = models.CharField(max_length=160, unique=True)
    muscle_group = models.CharField(max_length=80, blank=True)
    description = models.TextField(blank=True)
    source = models.CharField(max_length=40, default='custom')
    external_id = models.CharField(max_length=80, blank=True)
    class Meta:
        ordering = ['name']

class WorkoutExercise(models.Model):
    workout = models.ForeignKey(WorkoutPlan, on_delete=models.CASCADE, related_name='exercises')
    exercise = models.ForeignKey(Exercise, on_delete=models.PROTECT, related_name='workout_items')
    position = models.PositiveIntegerField(default=0)
    sets = models.PositiveIntegerField(default=3)
    reps = models.PositiveIntegerField(default=10)
    weight_kg = models.DecimalField(max_digits=7, decimal_places=2, default=0)
    calories_per_set = models.DecimalField(max_digits=7, decimal_places=2, default=0)
    class Meta:
        ordering = ['position', 'id']

class WorkoutSession(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='sessions')
    workout = models.ForeignKey(WorkoutPlan, on_delete=models.CASCADE, related_name='sessions')
    date = models.DateField()
    duration_minutes = models.PositiveIntegerField(default=0)
    completed = models.BooleanField(default=False)
    class Meta:
        constraints = [models.UniqueConstraint(fields=['user','workout','date'], name='unique_session_per_day')]
        ordering = ['-date']

class ExerciseLog(models.Model):
    session = models.ForeignKey(WorkoutSession, on_delete=models.CASCADE, related_name='logs')
    workout_exercise = models.ForeignKey(WorkoutExercise, on_delete=models.CASCADE, related_name='logs')
    completed = models.BooleanField(default=False)
    sets_completed = models.PositiveIntegerField(default=0)
    reps_completed = models.PositiveIntegerField(default=0)
    weight_kg = models.DecimalField(max_digits=7, decimal_places=2, default=0)
    class Meta:
        constraints = [models.UniqueConstraint(fields=['session','workout_exercise'], name='unique_exercise_log')]

class UserGoal(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='goal')
    weekly_calorie_target = models.PositiveIntegerField(default=2500)
    updated_at = models.DateTimeField(auto_now=True)

class ProgressPhoto(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='progress_photos')
    captured_at = models.DateTimeField(auto_now_add=True)
    image = models.ImageField(upload_to='progress_photos/%Y/%m/%d/')
    class Meta:
        ordering = ['-captured_at']
