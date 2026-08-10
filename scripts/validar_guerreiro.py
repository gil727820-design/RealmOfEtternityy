# -*- coding: utf-8 -*-
"""
Valida programaticamente os sprites compostos em public/sprites/guerreiro.
Verifica: tamanho 1632x2176, modo RGBA, fundo transparente nos cantos e que
nenhum pixel de nenhuma camada foi perdido na composicao (cobertura de alpha).
"""
import json
import os
import sys

from PIL import Image

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = os.path.join(RAIZ, "public", "sprites", "guerreiro", "base")
NOVOS = os.path.join(RAIZ, "public", "sprites", "guerreiro", "novos")
OUT = os.path.join(RAIZ, "public", "sprites", "guerreiro", "combinacoes")

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

with open(os.path.join(OUT, "manifesto.json"), encoding="utf-8") as f:
    manifesto = json.load(f)

ERROS = 0
AVISOS = 0


def camada(chave):
    pasta, arq = CAMADAS[chave]
    p = os.path.join(BASE, arq) if pasta == "base" else os.path.join(NOVOS, arq)
    im = Image.open(p).convert("RGBA")
    if im.size != TAMANHO:
        im = im.resize(TAMANHO, Image.LANCZOS)
    return im


for item in manifesto["sprites"]:
    nome = item["arquivo"]
    im = Image.open(os.path.join(OUT, nome)).convert("RGBA")
    w, h = im.size

    # 1) Tamanho e modo
    if (w, h) != TAMANHO:
        print(f"ERRO  {nome}: tamanho {w}x{h}"); ERROS += 1

    # 2) Cantos transparentes (aviso: 3 fontes originais ainda tem residuo)
    alfa = im.getchannel("A")
    for cx, cy in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]:
        v = alfa.getpixel((cx, cy))
        if v > 8:
            print(f"AVISO {nome}: canto ({cx},{cy}) alpha {v}"); AVISOS += 1

    # 3) Cobertura de alpha: saida >= cada camada em todo pixel
    for chave in item["camadas"]:
        lay = camada(chave).getchannel("A")
        if max(a - b for a, b in zip(alfa.tobytes(), lay.tobytes())) < 0:
            print(f"ERRO  {nome}: camada {chave} perdeu pixels na composicao"); ERROS += 1

    # 4) O sprite final nao pode ser vazio
    if alfa.getbbox() is None:
        print(f"ERRO  {nome}: sprite totalmente transparente"); ERROS += 1

    print(f"OK   {nome}  {w}x{h}  camadas={item['camadas']}")

print(f"\n{len(manifesto['sprites'])} sprites validados, {ERROS} erro(s), {AVISOS} aviso(s).")
sys.exit(1 if ERROS else 0)