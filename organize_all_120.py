import openpyxl
import csv

excel_path = "/Users/sidneyamorim/Desktop/Ajuste/Grupos Final_120.xlsx"
output_all_path = "/Users/sidneyamorim/Desktop/Ajuste/palpites_corrigidos.csv"
output_aline_path = "/Users/sidneyamorim/Desktop/Ajuste/palpites_aline.csv"

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
    'Belgica': 'Bélgica',
    'portugal': 'Portugal',
    'croácia': 'Croácia',
    'colombia': 'Colômbia',
    'gana': 'Gana',
    'equador': 'Equador',
    'Congo': 'República Democrática do Congo',
    'Árgélia': 'Argélia',
    'Inglaterra ': 'Inglaterra',
}

def clean_team_name(name):
    if not name:
        return ""
    name_str = str(name).strip()
    return team_mapping.get(name_str, name_str)

def clean_score(val):
    if val is None or val == "":
        return ""
    return str(val).strip()

valid_participants = {'sidney', 'eduardo', 'aline', 'matheus', 'mateus', 'silvio', 'daniel'}

wb = openpyxl.load_workbook(excel_path, data_only=True)

# ----------------- PARSE 'Grupos' SHEET -----------------
sheet_grupos = wb['Grupos']
block_starts_1based = [2, 14, 26, 38, 50, 62, 74, 85, 97, 109, 121, 133]

matchday_data_grupos = []

# Iterate rows to find matchdays
max_row_g = sheet_grupos.max_row
for r in range(1, max_row_g + 1):
    val_b = sheet_grupos.cell(row=r, column=2).value
    val_c = sheet_grupos.cell(row=r, column=3).value
    val_d = sheet_grupos.cell(row=r, column=4).value
    
    # Header row detection
    if val_b == 'Data' and val_c == 'Hr' and val_d == 'Nome':
        current_teams = {}
        current_actuals = {}
        for j, start_col in enumerate(block_starts_1based):
            home_team = sheet_grupos.cell(row=r, column=start_col + 4).value
            home_goals = sheet_grupos.cell(row=r, column=start_col + 5).value
            away_goals = sheet_grupos.cell(row=r, column=start_col + 7).value
            away_team = sheet_grupos.cell(row=r, column=start_col + 8).value
            if home_team and away_team and home_team != 'Gols' and away_team != 'Gols':
                current_teams[j] = (clean_team_name(home_team), clean_team_name(away_team))
                current_actuals[j] = (clean_score(home_goals), clean_score(away_goals))
        matchday_data_grupos.append({
            'teams': current_teams,
            'actuals': current_actuals,
            'predictions': []
        })
        continue
    
    # Prediction row detection
    if val_d and str(val_d).strip().lower() in valid_participants:
        if len(matchday_data_grupos) > 0:
            row_preds = {}
            for j, start_col in enumerate(block_starts_1based):
                if j not in matchday_data_grupos[-1]['teams']:
                    continue
                p_name = sheet_grupos.cell(row=r, column=start_col + 2).value
                name_to_use = str(p_name).strip() if p_name else str(val_d).strip()
                home_goals = sheet_grupos.cell(row=r, column=start_col + 5).value
                away_goals = sheet_grupos.cell(row=r, column=start_col + 7).value
                row_preds[j] = (name_to_use, clean_score(home_goals), clean_score(away_goals))
            matchday_data_grupos[-1]['predictions'].append(row_preds)

all_csv_rows = []
aline_predictions = []

# Output Group stage rows
for md in matchday_data_grupos:
    teams_dict = md['teams']
    actuals_dict = md['actuals']
    preds_list = md['predictions']
    
    for j in sorted(teams_dict.keys()):
        home_team, away_team = teams_dict[j]
        act_h, act_a = actuals_dict[j]
        
        # Oficial row
        all_csv_rows.append({
            'Nome': 'Oficial',
            'Time Casa': home_team,
            'Gols Casa': act_h,
            'Time Fora': away_team,
            'Gols Fora': act_a
        })
        
        # User predictions
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

print(f"Parsed 'Grupos': {len(all_csv_rows)} rows generated so far.")

# ----------------- PARSE '16 avos' SHEET -----------------
sheet_16 = wb['16 avos']
max_row_16 = sheet_16.max_row

count_16 = 0
for r in range(1, max_row_16 + 1):
    val_b = sheet_16.cell(row=r, column=2).value
    val_c = sheet_16.cell(row=r, column=3).value
    val_d = sheet_16.cell(row=r, column=4).value
    val_e = sheet_16.cell(row=r, column=5).value
    
    # Header row detection
    if val_b == 'Data' and val_c == 'Hr' and val_d == 'Nome' and val_e == 'Gols':
        home_team = sheet_16.cell(row=r, column=6).value
        home_goals = sheet_16.cell(row=r, column=7).value
        away_goals = sheet_16.cell(row=r, column=9).value
        away_team = sheet_16.cell(row=r, column=10).value
        
        if home_team and away_team:
            home_team_clean = clean_team_name(home_team)
            away_team_clean = clean_team_name(away_team)
            act_h = clean_score(home_goals)
            act_a = clean_score(away_goals)
            
            # Add Oficial row for 16-avos
            all_csv_rows.append({
                'Nome': 'Oficial',
                'Time Casa': home_team_clean,
                'Gols Casa': act_h,
                'Time Fora': away_team_clean,
                'Gols Fora': act_a
            })
            count_16 += 1
            
            # Read predictions in subsequent rows
            offset = 1
            while r + offset <= max_row_16:
                p_row = r + offset
                p_name = sheet_16.cell(row=p_row, column=4).value
                if p_name and str(p_name).strip().lower() in valid_participants:
                    username = str(p_name).strip()
                    if username.lower() == 'mateus':
                        username = 'Matheus'
                    pred_h = sheet_16.cell(row=p_row, column=7).value
                    pred_a = sheet_16.cell(row=p_row, column=9).value
                    
                    pred_dict = {
                        'Nome': username,
                        'Time Casa': home_team_clean,
                        'Gols Casa': clean_score(pred_h),
                        'Time Fora': away_team_clean,
                        'Gols Fora': clean_score(pred_a)
                    }
                    all_csv_rows.append(pred_dict)
                    if username.lower() == 'aline':
                        aline_predictions.append(pred_dict)
                    offset += 1
                else:
                    break

print(f"Parsed '16 avos': {count_16} games found. Total rows generated: {len(all_csv_rows)}")

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

print("Processamento completo!")
