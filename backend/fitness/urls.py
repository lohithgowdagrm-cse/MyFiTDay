from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework.authtoken.views import obtain_auth_token
from .views import register, login, me, summary, ai_coach, wger_search, toggle_exercise, toggle_today_exercise, export_photos, WorkoutPlanViewSet, SessionViewSet, GoalViewSet, PhotoViewSet, ExerciseViewSet

router = DefaultRouter()
router.register('workouts', WorkoutPlanViewSet, basename='workout')
router.register('sessions', SessionViewSet, basename='session')
router.register('goals', GoalViewSet, basename='goal')
router.register('photos', PhotoViewSet, basename='photo')
router.register('exercises', ExerciseViewSet, basename='exercise')

urlpatterns = [
    path('auth/register/', register),
    path('auth/login/', login),
    path('auth/me/', me),
    path('auth/token/', obtain_auth_token),
    path('', include(router.urls)),

    path('summary/', summary),
    path('ai/coach/', ai_coach),
    path('exercises/wger/', wger_search),

    path('sessions/today/toggle/', toggle_today_exercise),
    path('exercise-logs/<int:exercise_log_id>/toggle/', toggle_exercise),
]