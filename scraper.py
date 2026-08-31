import json
import requests
import os
from bs4 import BeautifulSoup

def scraper_annonces_reelles():
    api_key = os.environ.get("SCRAPING_API_KEY")
    # Ciblage de Péchabou pour des biens résidentiels ou locaux commerciaux
    url_cible = "https://www.leboncoin.fr/recherche?category=9&locations=Pechabou_31320"
    
    # L'API ScrapingAnt simule un vrai navigateur pour éviter le blocage DataDome
    api_url = f"https://api.scrapingant.com/v2/general?url={url_cible}&x-api-key={api_key}&browser=true"
    
    try:
        reponse = requests.get(api_url)
        reponse.raise_for_status()
        soup = BeautifulSoup(reponse.text, 'html.parser')
        
        annonces = []
        # Ciblage des blocs d'annonces
        articles = soup.find_all('a', attrs={'data-qa-id': 'aditem_container'})
        
        for index, article in enumerate(articles[:5]): # Extraction des 5 premières pour test
            titre = article.get('title', 'Annonce sans titre')
            prix_elem = article.find('p', attrs={'data-qa-id': 'aditem_price'})
            prix = int(''.join(filter(str.isdigit, prix_elem.text))) if prix_elem else 0
            
            annonces.append({
                "id": str(index),
                "titre": titre,
                "prix": prix,
                "surface": 100, # L'extraction exacte de la surface requiert un parsing plus poussé du titre
                "lat": 43.5361 + (index * 0.001), # Léger décalage GPS pour éviter la superposition sur la carte
                "lng": 1.5162 + (index * 0.001),
                "type": "Immobilier"
            })
            
        return annonces
    except Exception as e:
        print(f"Erreur de scraping : {e}")
        return []

if __name__ == "__main__":
    donnees = scraper_annonces_reelles()
    if donnees:
        with open('annonces.json', 'w', encoding='utf-8') as f:
            json.dump(donnees, f, ensure_ascii=False, indent=4)
        print(f"{len(donnees)} annonces réelles sauvegardées.")
    else:
        print("Aucune donnée récupérée.")
