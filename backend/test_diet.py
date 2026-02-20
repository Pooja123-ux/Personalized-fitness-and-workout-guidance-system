from app.logic import generate_recommendations

user_data = {
    'height_cm': 170,
    'weight_kg': 70,
    'lifestyle': 'sedentary',
    'motive': 'fitness',
    'diet_type': 'vegetarian',
    'diseases': '',
    'allergies': '',
    'age': 30,
    'gender': 'male',
    'level': 'beginner'
}

result = generate_recommendations(user_data)
for meal in result['diet']:
    print(f'{meal["meal_type"]}: {meal["food_name"]}')
