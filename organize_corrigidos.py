import csv

input_path = "/Users/sidneyamorim/Desktop/Ajuste/111.csv"
output_all_path = "/Users/sidneyamorim/Desktop/Ajuste/palpites_corrigidos.csv"
output_aline_path = "/Users/sidneyamorim/Desktop/Ajuste/palpites_aline.csv"

# The start indices of the 12 blocks in the CSV row
block_starts = [1, 13, 25, 37, 49, 61, 73, 84, 96, 108, 120, 132]

# Map to correct/official team names in Portuguese
team_mapping = {
    'Africa': 'África do Sul',
    'Arab Saudita': 'Arábia Saudita',
    'Arábia': 'Arábia Saudita',
    'Austria': 'Áustria',
    'Aústria': 'Áustria',
    'Cabo': 'Cabo Verde',
    'Cabo verde': 'Cabo Verde',
    'Cabo Verde': 'Cabo Verde',
    'Corea': 'Coreia do Sul',
    'Coréa': 'Coreia do Sul',
    'Cost Marfim': 'Costa do Marfim',
    'Haití': 'Haiti',
    'Jordania': 'Jordânia',
    'Noroega': 'Noruega',
    'Nova Zelandia': 'Nova Zelândia',
    'Tunisia': 'Tunísia',
    'Uzbequistão': 'Uzbequistão',
}

def clean_team_name(name):
    name = name.strip()
    return team_mapping.get(name, name)

current_teams = {}
current_actuals = {} # maps j -> (home_goals, away_goals)
all_rows = []
aline_predictions = []

with open(input_path, 'r', encoding='utf-8', errors='ignore') as f:
    lines = f.readlines()

for idx, line in enumerate(lines):
    parts = [p.strip() for p in line.split(';')]
    if len(parts) < 4:
        continue
    
    # Identify header row
    if parts[1] == 'Data' and parts[2] == 'Hr' and parts[3] == 'Nome':
        current_teams = {}
        current_actuals = {}
        for j, start_idx in enumerate(block_starts):
            if start_idx + 8 < len(parts):
                home_team = parts[start_idx + 4]
                home_goals = parts[start_idx + 5]
                away_goals = parts[start_idx + 7]
                away_team = parts[start_idx + 8]
                if home_team and away_team and home_team != 'Gols' and away_team != 'Gols':
                    h_team_clean = clean_team_name(home_team)
                    a_team_clean = clean_team_name(away_team)
                    current_teams[j] = (h_team_clean, a_team_clean)
                    current_actuals[j] = (home_goals, away_goals)
        continue
    
    # Parse prediction rows
    first_name = parts[3]
    if first_name and first_name != 'Nome':
        # First, if we haven't written the Official rows for this matchday round,
        # let's write them! But wait, it's cleaner to group predictions by match.
        # Let's collect the raw prediction entries first, then we can group and write.
        pass

# Let's rebuild the parsing logic to write:
# For each matchday (determined by the header):
# Write 'Oficial' row for each of the 12 matches, then write predictions of the 6 users for each of the 12 matches.
# This makes it very clean.
current_teams = {}
current_actuals = {}
matchday_data = [] # list of dicts: {'teams': {j: (home, away)}, 'actuals': {j: (g_h, g_a)}, 'predictions': [list of user predictions]}

for idx, line in enumerate(lines):
    parts = [p.strip() for p in line.split(';')]
    if len(parts) < 4:
        continue
    
    # Identify header row
    if parts[1] == 'Data' and parts[2] == 'Hr' and parts[3] == 'Nome':
        current_teams = {}
        current_actuals = {}
        for j, start_idx in enumerate(block_starts):
            if start_idx + 8 < len(parts):
                home_team = parts[start_idx + 4]
                home_goals = parts[start_idx + 5]
                away_goals = parts[start_idx + 7]
                away_team = parts[start_idx + 8]
                if home_team and away_team and home_team != 'Gols' and away_team != 'Gols':
                    current_teams[j] = (clean_team_name(home_team), clean_team_name(away_team))
                    current_actuals[j] = (home_goals, away_goals)
        matchday_data.append({
            'teams': current_teams,
            'actuals': current_actuals,
            'predictions': []
        })
        continue
    
    # Parse prediction rows
    first_name = parts[3]
    if first_name and first_name != 'Nome' and len(matchday_data) > 0:
        row_preds = {}
        for j, start_idx in enumerate(block_starts):
            if j not in matchday_data[-1]['teams']:
                continue
            if start_idx + 7 < len(parts):
                p_name = parts[start_idx + 2]
                name_to_use = p_name if p_name else first_name
                home_goals = parts[start_idx + 5]
                away_goals = parts[start_idx + 7]
                row_preds[j] = (name_to_use, home_goals, away_goals)
        matchday_data[-1]['predictions'].append(row_preds)

# Now, generate all CSV rows in order:
# For each matchday:
#   For each match j:
#     Write 'Oficial' row
#     Write predictions of all users for match j
all_csv_rows = []
aline_predictions = []

for md in matchday_data:
    teams_dict = md['teams']
    actuals_dict = md['actuals']
    preds_list = md['predictions']
    
    for j in sorted(teams_dict.keys()):
        home_team, away_team = teams_dict[j]
        act_h, act_a = actuals_dict[j]
        
        # Add Oficial row
        all_csv_rows.append({
            'Nome': 'Oficial',
            'Time Casa': home_team,
            'Gols Casa': act_h,
            'Time Fora': away_team,
            'Gols Fora': act_a
        })
        
        # Add user prediction rows
        for user_pred in preds_list:
            if j in user_pred:
                username, pred_h, pred_a = user_pred[j]
                pred_dict = {
                    'Nome': username,
                    'Time Casa': home_team,
                    'Gols Casa': pred_h,
                    'Time Fora': away_team,
                    'Gols Fora': pred_a
                }
                all_csv_rows.append(pred_dict)
                if username.lower() == 'aline':
                    aline_predictions.append(pred_dict)

# Write all predictions to palpites_corrigidos.csv using comma
with open(output_all_path, 'w', encoding='utf-8', newline='') as f:
    writer = csv.DictWriter(f, fieldnames=['Nome', 'Time Casa', 'Gols Casa', 'Time Fora', 'Gols Fora'], delimiter=',')
    writer.writeheader()
    for pred in all_csv_rows:
        writer.writerow(pred)

# Write Aline's predictions
with open(output_aline_path, 'w', encoding='utf-8', newline='') as f:
    writer = csv.DictWriter(f, fieldnames=['Nome', 'Time Casa', 'Gols Casa', 'Time Fora', 'Gols Fora'], delimiter=';')
    writer.writeheader()
    for pred in aline_predictions:
        writer.writerow(pred)

print(f"Sucesso! Gerados {len(all_csv_rows)} palpites (incluindo oficiais) em {output_all_path}")
print(f"Gerados {len(aline_predictions)} palpites da Aline em {output_aline_path}")
