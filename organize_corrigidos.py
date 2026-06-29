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
all_predictions = []
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
        for j, start_idx in enumerate(block_starts):
            if start_idx + 8 < len(parts):
                home_team = parts[start_idx + 4]
                away_team = parts[start_idx + 8]
                if home_team and away_team and home_team != 'Gols' and away_team != 'Gols':
                    current_teams[j] = (clean_team_name(home_team), clean_team_name(away_team))
        continue
    
    # Parse prediction rows
    first_name = parts[3]
    if first_name and first_name != 'Nome':
        for j, start_idx in enumerate(block_starts):
            if j not in current_teams:
                continue
            if start_idx + 7 < len(parts):
                p_name = parts[start_idx + 2]
                name_to_use = p_name if p_name else first_name
                
                home_goals = parts[start_idx + 5]
                away_goals = parts[start_idx + 7]
                
                home_team, away_team = current_teams[j]
                
                pred_dict = {
                    'Nome': name_to_use,
                    'Time Casa': home_team,
                    'Gols Casa': home_goals,
                    'Time Fora': away_team,
                    'Gols Fora': away_goals
                }
                
                all_predictions.append(pred_dict)
                if name_to_use.lower() == 'aline':
                    aline_predictions.append(pred_dict)

# Write all predictions to palpites_corrigidos.csv using comma
with open(output_all_path, 'w', encoding='utf-8', newline='') as f:
    writer = csv.DictWriter(f, fieldnames=['Nome', 'Time Casa', 'Gols Casa', 'Time Fora', 'Gols Fora'], delimiter=',')
    writer.writeheader()
    for pred in all_predictions:
        writer.writerow(pred)

# Write Aline's predictions
with open(output_aline_path, 'w', encoding='utf-8', newline='') as f:
    writer = csv.DictWriter(f, fieldnames=['Nome', 'Time Casa', 'Gols Casa', 'Time Fora', 'Gols Fora'], delimiter=';')
    writer.writeheader()
    for pred in aline_predictions:
        writer.writerow(pred)

print(f"Sucesso! Gerados {len(all_predictions)} palpites corrigidos em {output_all_path}")
print(f"Gerados {len(aline_predictions)} palpites da Aline em {output_aline_path}")
