# -*- coding: utf-8 -*-
"""Inspeciona as camadas e combinações do guerreiro para auditar o alinhamento.

Mostra tamanho e bounding box (pixels visíveis) de cada peça no canvas. Se todas
as camadas estivessem perfeitamente alinhadas (mesma régua de canvas), os
bounding boxes cairiam em regiões compatíveis com a estrutura do corpo base.
"""
import os
from PIL import Image

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = os.path.join(RAIZ, "public", "sprites", "guerreiro", "base")
NOVOS = os.path.join(RAIZ, "public", "sprites", "guerreiro", "novos")
OUT = os.path.join(RAIZ, "public", "sprites", "guerreiro", "combinacoes")

CAMADAS = {
    "corpo": ("base", "00_corpo_base.png"),
    "capacete": ("base", "04_capacete.png"),
    "capa_inicial": ("base", "03_capa.png"),
    "escudo_inicial": ("base", "02_escudo.png"),
    "espada_inicial": ("base", "espada_v1_ferro.png"),
    "espada_classica": ("novos", "01_espada.PNG"),
    "armadura_cavaleiro": ("novos", "armadura_v1_cavaleiro.png"),
    "armadura_negra": ("novos", "armadura_v2_negra.png"),
    "capa_real": ("novos", "capa_v1_real.png"),
    "capa_arcano": ("novos", "capa_v2_arcano.png"),
    "escudo_ferro": ("novos", "escudo_v1_ferro.png"),
    "escudo_ouro": ("novos", "escudo_v2_ouro.png"),
    "escudo_cristal": ("novos", "escudo_v3_cristal.png"),
    "espada_chama": ("novos", "espada_v2_chama.png"),
    "espada_sombra": ("novos", "espada_v3_sombra.png"),
}


def visivel(caminho):
    im = Image.open(caminho).convert("RGBA")
    alfa = im.getchannel("A")
    return im.size, alfa.getbbox()


print("=== PECAS ===")
for chave, (pasta, arq) in CAMADAS.items():
    p = os.path.join(BASE, arq) if pasta == "base" else os.path.join(NOVOS, arq)
    if not os.path.exists(p):
        print(f"{chave:20s} NAO ENCONTRADO: {p}")
        continue
    size, bbox = visivel(p)
    print(f"{chave:20s} {size[0]}x{size[1]}  visivel={bbox}")

print("\n=== COMBINACOES (referencia do que foi gerado offline) ===")
if os.path.isdir(OUT):
    for nome in sorted(os.listdir(OUT)):
        if nome.endswith(".png"):
            size, bbox = visivel(os.path.join(OUT, nome))
            print(f"{nome:44s} {size[0]}x{size[1]}  visivel={bbox}")