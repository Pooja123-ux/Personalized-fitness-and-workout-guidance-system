# TODO: Enhance recommendations with user preferences

## Completed Tasks
- [x] Add load_foods and modified suggest_for_target functions to logic.py
- [x] Modify generate_recommendations to use suggest_for_target instead of ml_diet_recommendation
- [x] Load and filter foods based on diseases and diet_type
- [x] Compute meal targets for breakfast, lunch, snacks, dinner
- [x] Generate 6 diet options per meal using suggest_for_target
- [x] Build diet list with main recommendations and alternatives
- [x] Include nutrition info (protein, carbs, fat) per serving in output

## Updated Tasks
- [x] Add allergy filtering to exclude foods with allergens
- [x] Prioritize foods similar to user's regular meals (from user_meals)
- [x] For snacks, include fruits in suggestions
- [x] For breakfast/lunch/dinner, prioritize healthier options (lower calorie density, higher protein)
- [x] Increase alternatives to 10 per meal
- [x] Modify suggest_for_target to incorporate user preferences and health scoring

## Followup Steps
- [x] Test the recommendations API with user preferences
- [x] Verify allergy filtering works
- [x] Check that fruits are included in snacks
- [x] Confirm healthier options are prioritized for main meals
- [x] Update TODO.md with final status
