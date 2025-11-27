const STRAPI_URL = 'http://localhost:1337/api/recipes?populate=*'

async function loadRecipesFromStrapi() {
  try {
    const res = await fetch(STRAPI_URL)
    const json = await res.json()

    console.log('Risposta Strapi:', json)

    if (!json.data) {
      alert('Nessun dato ricevuto da Strapi')
      return
    }

    const ricette = json.data.map(item => ({
      id: item.id,
      title: item.title,
      description: item.description,
      prepTime: item.prepTime,
      cookTime: item.cookTime,
      difficulty: item.difficulty,
      servings: item.servings,
      slug: item.slug
    }))

    console.log('Ricette trasformate:', ricette)
    alert('Strapi funziona. Controlla la console.')
  } catch (error) {
    console.error('Errore:', error)
    alert('Errore nel caricamento da Strapi')
  }
}

loadRecipesFromStrapi()
