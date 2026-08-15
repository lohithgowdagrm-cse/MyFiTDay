from django.contrib import admin
from .models import Exercise, WorkoutPlan, WorkoutExercise, WorkoutSession, ExerciseLog, UserGoal, ProgressPhoto
admin.site.register([Exercise, WorkoutPlan, WorkoutExercise, WorkoutSession, ExerciseLog, UserGoal, ProgressPhoto])
