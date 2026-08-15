from django.contrib.auth import get_user_model
from rest_framework import serializers
from .models import Exercise, WorkoutPlan, WorkoutExercise, WorkoutSession, ExerciseLog, UserGoal, ProgressPhoto

User = get_user_model()

class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    class Meta:
        model = User
        fields = ('username','email','password')
    def create(self, validated_data):
        return User.objects.create_user(**validated_data)

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id','username','email')

class ExerciseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Exercise
        fields = '__all__'

class WorkoutExerciseSerializer(serializers.ModelSerializer):
    exercise = ExerciseSerializer(read_only=True)
    exercise_id = serializers.PrimaryKeyRelatedField(source='exercise', queryset=Exercise.objects.all(), write_only=True)
    class Meta:
        model = WorkoutExercise
        fields = ('id','exercise','exercise_id','position','sets','reps','weight_kg','calories_per_set')

class WorkoutPlanSerializer(serializers.ModelSerializer):
    exercises = WorkoutExerciseSerializer(many=True, read_only=True)
    class Meta:
        model = WorkoutPlan
        fields = ('id','day_of_week','name','duration_minutes','is_rest_day','exercises')

class ExerciseLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExerciseLog
        fields = ('id','workout_exercise','completed','sets_completed','reps_completed','weight_kg')

class WorkoutSessionSerializer(serializers.ModelSerializer):
    logs = ExerciseLogSerializer(many=True, read_only=True)
    class Meta:
        model = WorkoutSession
        fields = ('id','workout','date','duration_minutes','completed','logs')

class GoalSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserGoal
        fields = ('weekly_calorie_target','updated_at')

class ProgressPhotoSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProgressPhoto
        fields = ('id','captured_at','image')
        read_only_fields = ('id','captured_at')
