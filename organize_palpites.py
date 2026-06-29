import csv

input_path = "/Users/sidneyamorim/Desktop/Ajuste/111.csv"
output_path = "/Users/sidneyamorim/Desktop/Ajuste/palpites_organizados.csv"

# The start indices of the 12 blocks in the CSV row
block_starts = [1, 13, 25, 37, 49, 61, 73, 84, 96, 108, 120, 132]

current_teams = {} # maps j -> (home_team, away_team)
all_predictions = []

with open(input_path, 'r', encoding='utf-8', errors='ignore') as f:
    lines = f.readlines()

for idx, line in enumerate(lines):
    parts = [p.strip() for p in line.split(';')]
    if len(parts) < 4:
        continue
    
    # Identify header row
    # A header row has "Data" at index 1, "Hr" at index 2, "Nome" at index 3
    if parts[1] == 'Data' and parts[2] == 'Hr' and parts[3] == 'Nome':
        current_teams = {}
        for j, start_idx in enumerate(block_starts):
            if start_idx + 8 < len(parts):
                home_team = parts[start_idx + 4]
                away_team = parts[start_idx + 8]
                if home_team and away_team and home_team != 'Gols' and away_team != 'Gols':
                    current_teams[j] = (home_team, away_team)
        continue
    
    # Parse prediction rows
    # Check if this row belongs to participants
    # We can inspect if the name field in the first block is a known participant or not empty
    first_name = parts[3]
    if first_name and first_name != 'Nome':
        for j, start_idx in enumerate(block_starts):
            if j not in current_teams:
                continue
            if start_idx + 7 < len(parts):
                p_name = parts[start_idx + 2]
                # If name in this block is empty but we have a first_name, we can fallback to first_name
                # or if it's explicitly written, use it.
                name_to_use = p_name if p_name else first_name
                
                home_goals = parts[start_idx + 5]
                away_goals = parts[start_idx + 7]
                
                home_team, away_team = current_teams[j]
                
                all_predictions.append({
                    'Nome': name_to_use,
                    'Time Casa': home_team,
                    'Gols Casa': home_goals,
                    'Time Fora': away_team,
                    'Gols Fora': away_goals
                })

# Write to output CSV
with open(output_path, 'w', encoding='utf-8', newline='') as f:
    writer = csv.DictWriter(f, fieldnames=['Nome', 'TimeCasa', 'GolsCasa', 'TimeFora', 'GolsFora'], delimiter=';')
    writer.writeheader()
    for pred in all_predictions:
        writer.writerow({
            'Nome': pred['Nome'],
            'TimeCasa': pred['Time Casa'],
            'GolsCasa': pred['Gols Casa'],
            'TimeFora': pred['Time Fora'],
            'GolsFora': pred['Gols Fora']
        })

print(f"Sucesso! Gerados {len(all_predictions)} palpites em {output_path}")
