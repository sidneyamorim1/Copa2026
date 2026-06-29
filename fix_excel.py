def calcular_pontuacao(palpite_mandante, palpite_visitante, placar_mandante, placar_visitante):
    # Trata valores vazios como 0 pontos
    if palpite_mandante in (None, "") or palpite_visitante in (None, ""):
        return 0
        
    try:
        palpite_mandante = int(palpite_mandante)
        palpite_visitante = int(palpite_visitante)
        placar_mandante = int(placar_mandante)
        placar_visitante = int(placar_visitante)
    except ValueError:
        return 0

    # Condição 1: Acerto exato do placar
    if palpite_mandante == placar_mandante and palpite_visitante == placar_visitante:
        return 5
        
    # Condição 2: Errou o vencedor, mas apostou exatamente o placar invertido (se não foi empate)
    if (placar_mandante != placar_visitante and 
        palpite_mandante == placar_visitante and 
        palpite_visitante == placar_mandante):
        return -3
        
    # Condição 3: Acertou quem venceu (ou se foi empate)
    def sinal(valor):
        if valor > 0: return 1
        if valor < 0: return -1
        return 0

    sinal_palpite = sinal(palpite_mandante - palpite_visitante)
    sinal_placar = sinal(placar_mandante - placar_visitante)
    
    if placar_mandante != placar_visitante and sinal_palpite == sinal_placar:
        return 3
        
    # Caso nenhuma regra anterior se aplique
    return 0

# Exemplo de uso
if __name__ == "__main__":
    print("Testes:")
    print("Acerto Exato (2x1, Placar 2x1):", calcular_pontuacao(2, 1, 2, 1), "pontos")
    print("Placar Invertido (1x2, Placar 2x1):", calcular_pontuacao(1, 2, 2, 1), "pontos")
    print("Acertou Vencedor (3x0, Placar 2x1):", calcular_pontuacao(3, 0, 2, 1), "pontos")
    print("Erro Total (0x3, Placar 2x1):", calcular_pontuacao(0, 3, 2, 1), "pontos")
    print("Vazio:", calcular_pontuacao("", 1, 2, 1), "pontos")
