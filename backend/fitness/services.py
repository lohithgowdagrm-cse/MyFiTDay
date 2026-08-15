import json
import requests
from datetime import date, timedelta
from django.conf import settings
from .models import WorkoutPlan, WorkoutSession, UserGoal

DAY_NAMES = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']

def estimate_exercise_calories(item):
    # Planning estimate only. It is deliberately deterministic and should not be presented as medical advice.
    return round(float(item.sets * item.reps * max(float(item.calories_per_set), 0.55)), 1)

def weekly_summary(user, anchor=None):
    anchor = anchor or date.today()
    monday = anchor - timedelta(days=anchor.weekday())
    sunday = monday + timedelta(days=6)
    sessions = WorkoutSession.objects.filter(user=user, date__range=(monday, sunday)).select_related('workout').prefetch_related('workout__exercises')
    daily = []
    total_duration = 0
    total_calories = 0
    for i in range(7):
        d = monday + timedelta(days=i)
        day_sessions = [s for s in sessions if s.date == d]
        duration = sum(s.duration_minutes for s in day_sessions)
        calories = sum(sum(estimate_exercise_calories(x) for x in s.workout.exercises.all()) for s in day_sessions)
        total_duration += duration
        total_calories += calories
        daily.append({'date': d.isoformat(), 'day': DAY_NAMES[i], 'duration_minutes': duration, 'calories': round(calories)})
    goal, _ = UserGoal.objects.get_or_create(user=user)
    return {'daily': daily, 'total_duration_minutes': total_duration, 'total_calories': round(total_calories), 'average_daily_calories': round(total_calories / 7), 'weekly_goal': goal.weekly_calorie_target}

def fallback_coach(summary, prompt=''):
    pct = round(summary['total_calories'] / summary['weekly_goal'] * 100) if summary['weekly_goal'] else 0
    if pct >= 100:
        advice = 'You reached your weekly calorie target. Prioritize recovery, sleep, hydration, and consistent technique rather than adding unnecessary volume.'
    elif pct >= 70:
        advice = 'You are on track. Finish your planned sessions and only increase volume gradually if recovery and technique remain strong.'
    else:
        advice = 'Focus on consistency first. Complete the planned exercises before increasing load or adding extra sessions.'
    return {'title': 'MyFiTDay Coach', 'recommendation': advice, 'weekly_target_percent': min(pct, 100), 'source': 'rule-based fallback'}

def ask_ollama(summary, prompt=''):
    system = (
        'You are MyFiTDay Coach, a conservative fitness planning assistant. '
        'Use the supplied workout statistics. Do not diagnose illness, prescribe treatment, or claim exact calorie burn. '
        'Give practical, beginner-friendly recommendations and clearly state that calorie numbers are estimates. '
        'Return JSON with keys title, recommendation, next_steps (array of strings), and safety_note.'
    )
    payload = {
        'model': settings.OLLAMA_MODEL,
        'stream': False,
        'format': 'json',
        'messages': [
            {'role': 'system', 'content': system},
            {'role': 'user', 'content': json.dumps({'stats': summary, 'question': prompt}, default=str)},
        ],
    }
    response = requests.post(f'{settings.OLLAMA_BASE_URL}/api/chat', json=payload, timeout=60)
    response.raise_for_status()
    content = response.json()['message']['content']
    result = json.loads(content)
    result['source'] = f'ollama:{settings.OLLAMA_MODEL}'
    return result

def coach(summary, prompt=''):
    try:
        return ask_ollama(summary, prompt)
    except (requests.RequestException, ValueError, KeyError, TypeError):
        return fallback_coach(summary, prompt)

def wger_exercises(search=''):
    params = {'limit': 20}
    if search:
        params['name'] = search
    r = requests.get(f'{settings.WGER_BASE_URL}/exercise/', params=params, timeout=15)
    r.raise_for_status()
    return r.json()
