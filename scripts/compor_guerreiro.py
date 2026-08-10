# -*- coding: utf-8 -*-
"""
Gera combinações de pixel art do guerreiro a partir dos sprites locais já
copiados em public/sprites/guerreiro/{base,novos}.

Cada sprite final eh um PNG 1632x2176 (RGBA, fundo transparente), composto por
alpha compositing das camadas na ordem (de tras para a frente):

    capa -> corpo -> armadura -> capacete -> escudo -> espada

Todos os itens sao redimensionados (quando necessario) para o canvas 1632x2176
(mesma proporcao 3:4) e empilhados por alpha compositing na ordem:

    capa -> corpo -> armadura -> capacete -> escudo -> espada

Nenhum reposicionamento e necessario alem da normalizacao de escala.
"""
import json
import os

from PIL import Image

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = os.path.join(RAIZ, "public", "sprites", "guerreiro", "base")
NOVOS = os.path.join(RAIZ, "public", "sprites", "guerreiro", "novos")
OUT = os.path.join(RAIZ, "public", "sprites", "guerreiro", "combinacoes")

os.makedirs(OUT, exist_ok=True)

# Atalhos: chave -> (pasta, arquivo de sprite). A pasta pode ser "base"
# (CORPO BASE E ITENS INICIAL) ou "novos" (armadura e armas).
CAMADAS = {
    "corpo":             ("base", "00_corpo_base.png"),
    "capacete":          ("base", "04_capacete.png"),
    "capa_inicial":      ("base", "03_capa.png"),
    "escudo_inicial":    ("base", "02_escudo.png"),
    "espada_inicial":    ("base", "espada_v1_ferro.png"),
    "espada_classica":   ("novos", "01_espada.PNG"),
    "armadura_cavaleiro": ("novos", "armadura_v1_cavaleiro.png"),
    "armadura_negra":    ("novos", "armadura_v2_negra.png"),
    "capa_real":         ("novos", "capa_v1_real.png"),
    "capa_arcano":       ("novos", "capa_v2_arcano.png"),
    "escudo_ferro":      ("novos", "escudo_v1_ferro.png"),
    "escudo_ouro":       ("novos", "escudo_v2_ouro.png"),
    "escudo_cristal":    ("novos", "escudo_v3_cristal.png"),
    "espada_chama":      ("novos", "espada_v2_chama.png"),
    "espada_sombra":     ("novos", "espada_v3_sombra.png"),
}

TAMANHO = (1632, 2176)

# Ordem de empilhamento (de tras para a frente).
ORDEM = [
    "capa_inicial", "capa_real", "capa_arcano",  # capas atras
    "corpo",                                      # corpo base
    "armadura_cavaleiro", "armadura_negra",       # armaduras sobre o corpo
    "capacete",                                   # capacete sobre a cabeca
    "escudo_inicial", "escudo_ferro", "escudo_ouro", "escudo_cristal",
    "espada_inicial", "espada_classica", "espada_chama", "espada_sombra",
]
INDICE = {k: i for i, k in enumerate(ORDEM)}

# Combinações: (nome do arquivo final, [chaves das camadas, em ordem de base])
COMBOS = [
    # --- Base e itens iniciais -------------------------------------------
    ("01_guerreiro_corpo.png", ["corpo"]),
    ("02_guerreiro_completo_inicial.png",
     ["capa_inicial", "corpo", "capacete", "escudo_inicial", "espada_inicial"]),

    # --- Pecas novas individualmente no corpo base ------------------------
    ("03_guerreiro_capa_real.png", ["capa_real", "corpo"]),
    ("04_guerreiro_capa_arcano.png", ["capa_arcano", "corpo"]),
    ("05_guerreiro_armadura_cavaleiro.png", ["corpo", "armadura_cavaleiro", "capacete"]),
    ("06_guerreiro_armadura_negra.png", ["corpo", "armadura_negra", "capacete"]),
    ("07_guerreiro_espada_chama.png", ["corpo", "espada_chama"]),
    ("08_guerreiro_espada_sombra.png", ["corpo", "espada_sombra"]),
    ("09_guerreiro_escudo_ouro.png", ["corpo", "escudo_ouro"]),
    ("10_guerreiro_escudo_cristal.png", ["corpo", "escudo_cristal"]),

    # --- Sets completos (sem armadura) --------------------------------------
    ("11_set_cavaleiro_ferro.png",
     ["capa_real", "corpo", "capacete", "escudo_ferro", "espada_inicial"]),
    ("12_set_cavaleiro_ouro.png",
     ["capa_real", "corpo", "capacete", "escudo_ouro", "espada_inicial"]),
    ("13_set_cavaleiro_cristal.png",
     ["capa_arcano", "corpo", "capacete", "escudo_cristal", "espada_inicial"]),
    ("14_set_cavaleiro_chama.png",
     ["capa_real", "corpo", "capacete", "escudo_ouro", "espada_chama"]),

    # --- Sets completos com novas armaduras ---------------------------------
    ("15_set_guerreiro_sombrio.png",
     ["capa_arcano", "corpo", "armadura_negra", "capacete", "escudo_cristal", "espada_sombra"]),
    ("16_set_guerreiro_sombrio_ferro.png",
     ["capa_arcano", "corpo", "armadura_negra", "capacete", "escudo_ferro", "espada_sombra"]),
    ("17_set_armadura_cavaleiro_ferro.png",
     ["capa_real", "corpo", "armadura_cavaleiro", "capacete", "escudo_ferro", "espada_inicial"]),
    ("18_set_armadura_cavaleiro_chama.png",
     ["capa_real", "corpo", "armadura_cavaleiro", "capacete", "escudo_ouro", "espada_chama"]),
    ("19_set_armadura_cavaleiro_cristal.png",
     ["capa_arcano", "corpo", "armadura_cavaleiro", "capacete", "escudo_cristal", "espada_inicial"]),
    ("20_set_espada_classica.png",
     ["capa_inicial", "corpo", "capacete", "escudo_inicial", "espada_classica"]),
]


def carregar(chave):
    pasta, arquivo = CAMADAS[chave]
    caminho = os.path.join(BASE, arquivo) if pasta == "base" else os.path.join(NOVOS, arquivo)
    if not os.path.exists(caminho):
        raise FileNotFoundError(f"Arquivo de camada nao encontrado: {arquivo}")
    imagem = Image.open(caminho).convert("RGBA")
    if imagem.size != TAMANHO:
        # Itens novos podem vir em escala menor (mesma proporcao 3:4 do
        # canvas). Redimensiona de volta para 1632x2176 mantendo o alinhamento.
        imagem = imagem.resize(TAMANHO, Image.LANCZOS)
    return imagem


def montar(chaves):
    """Empilha as camadas (de tras para a frente) em um canvas transparente."""
    camadas = [carregar(chave) for chave in sorted(chaves, key=lambda c: INDICE[c])]

    canvas = Image.new("RGBA", TAMANHO, (0, 0, 0, 0))
    for camada in camadas:
        canvas = Image.alpha_composite(canvas, camada)
    return canvas


def main():
    manifesto = {"tamanho": [1632, 2176], "ordem_camadas": ORDEM, "sprites": []}
    for nome, chaves in COMBOS:
        saida = os.path.join(OUT, nome)
        imagem = montar(chaves)
        imagem.save(saida, optimize=True, compress_level=9)
        manifesto["sprites"].append(
            {"arquivo": nome, "camadas": list(chaves), "tamanho": list(imagem.size)}
        )
        print(f"OK  {nome}  ({len(chaves)} camadas)")

    with open(os.path.join(OUT, "manifesto.json"), "w", encoding="utf-8") as f:
        json.dump(manifesto, f, ensure_ascii=False, indent=2)
    print(f"\n{len(COMBOS)} sprites gerados em: {OUT}")
    print("Manifesto: manifesto.json")


if __name__ == "__main__":
    main()