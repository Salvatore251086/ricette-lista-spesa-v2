import fs from 'fs'
import path from 'path'

const srcPath = new URL('../assets/json/recipes-it.json', import.meta.url)
const raw = fs.readFileSync(srcPath, 'utf8')
const container = JSON.parse(raw)
const recipes = Array.isArray(container) ? container : container.recipes

const updates = {
  'ricetta-ragu-alla-bolognese': {
    ingredients: [
      '400 g carne macinata di manzo',
      '200 g carne macinata di maiale',
      '1 carota',
      '1 costa di sedano',
      '1 cipolla',
      '3 cucchiai di olio evo',
      '30 g burro',
      '100 ml vino bianco secco',
      '400 g passata di pomodoro',
      '200 ml brodo vegetale',
      '1 bicchiere di latte intero',
      'sale',
      'pepe'
    ],
    instructions:
      '1. Tritura finemente cipolla, carota e sedano.\n' +
      '2. Rosola le verdure in olio e burro a fuoco dolce per 5–6 minuti.\n' +
      '3. Aggiungi le carni macinate e fai rosolare mescolando finché non cambiano colore.\n' +
      '4. Sfuma con il vino bianco e lascia evaporare.\n' +
      '5. Unisci la passata di pomodoro e una parte di brodo, regola di sale e pepe.\n' +
      '6. Fai cuocere coperto a fuoco molto basso per almeno 1 ora, aggiungendo brodo se serve.\n' +
      '7. A fine cottura versa il latte, mescola e lascia sobbollire ancora 10 minuti.'
  },
  'ricetta-orecchiette-con-cime-di-rapa': {
    ingredients: [
      '320 g orecchiette',
      '500 g cime di rapa pulite',
      '2 spicchi di aglio',
      '4 filetti di acciuga sottolio',
      'olio evo',
      'peperoncino',
      'sale'
    ],
    instructions:
      '1. Porta a bollore una pentola con acqua salata.\n' +
      '2. Lava le cime di rapa e taglia le parti più grosse dei gambi.\n' +
      '3. Tuffa insieme orecchiette e cime di rapa e cuoci fino a quando la pasta è al dente.\n' +
      '4. In una padella scalda olio con aglio e peperoncino, poi sciogli le acciughe a fuoco dolce.\n' +
      '5. Scola pasta e verdura tenendo da parte un po’ di acqua di cottura.\n' +
      '6. Salta il tutto in padella con il condimento, aggiungendo poca acqua se serve.\n' +
      '7. Servi subito ben caldo.'
  },
  'ricetta-orecchiette-con-i-broccoli': {
    ingredients: [
      '320 g orecchiette',
      '400 g broccoli',
      '2 spicchi di aglio',
      '4 filetti di acciuga sottolio',
      'olio evo',
      'peperoncino',
      'sale'
    ],
    instructions:
      '1. Dividi i broccoli in cimette e sciacquali.\n' +
      '2. Porta a bollore una pentola di acqua salata.\n' +
      '3. Cuoci insieme orecchiette e broccoli finché la pasta è al dente.\n' +
      '4. In una padella scalda olio con aglio e peperoncino, poi aggiungi le acciughe e falle sciogliere.\n' +
      '5. Scola pasta e broccoli tenendo un po’ di acqua di cottura.\n' +
      '6. Salta in padella con il condimento, regolando la cremosità con poca acqua.\n' +
      '7. Servi con un filo di olio a crudo.'
  },
  'ricetta-gnocchi-alla-bava': {
    ingredients: [
      '800 g gnocchi di patate',
      '200 g fontina o formaggio filante',
      '60 g burro',
      '50 g parmigiano grattugiato',
      'latte q.b.',
      'sale',
      'pepe'
    ],
    instructions:
      '1. Taglia la fontina a cubetti e mettila in una ciotola con poco latte per ammorbidirla.\n' +
      '2. Sciogli metà burro in una padella capiente a fuoco dolce.\n' +
      '3. Porta a bollore una pentola di acqua salata e cuoci gli gnocchi.\n' +
      '4. Quando salgono a galla scolali con una schiumarola direttamente nella padella con il burro.\n' +
      '5. Aggiungi la fontina scolata dal latte e il parmigiano.\n' +
      '6. Mescola a fuoco basso finché il formaggio è fuso e cremoso, regolando con poco latte se serve.\n' +
      '7. Completa con il resto del burro, pepe macinato e servi subito.'
  },
  'ricetta-passatelli-in-brodo': {
    ingredients: [
      '150 g pangrattato',
      '150 g parmigiano grattugiato',
      '3 uova',
      '1 pizzico di noce moscata',
      'scorza di limone grattugiata (facoltativa)',
      'sale',
      '1,5 l brodo di carne o cappone'
    ],
    instructions:
      '1. In una ciotola mescola pangrattato e parmigiano.\n' +
      '2. Aggiungi le uova, la noce moscata, un pizzico di sale e la scorza di limone se ti piace.\n' +
      '3. Impasta fino a ottenere un composto sodo ma lavorabile, poi lascia riposare 15 minuti.\n' +
      '4. Porta a bollore il brodo.\n' +
      '5. Schiaccia l’impasto con lo strumento per passatelli o uno schiacciapatate a fori grossi, direttamente sopra la pentola.\n' +
      '6. Cuoci pochi minuti, finché i passatelli salgono a galla.\n' +
      '7. Servi nel brodo caldo.'
  },
  'ricetta-tiramisu': {
    ingredients: [
      '300 g savoiardi',
      '500 g mascarpone',
      '4 uova fresche',
      '100 g zucchero',
      '300 ml caffè espresso freddo',
      'cacao amaro in polvere',
      '1 pizzico di sale'
    ],
    instructions:
      '1. Separa tuorli e albumi.\n' +
      '2. Monta i tuorli con lo zucchero fino a ottenere una crema chiara.\n' +
      '3. Incorpora il mascarpone ai tuorli poco per volta, mescolando dal basso verso l’alto.\n' +
      '4. Monta gli albumi a neve con un pizzico di sale e uniscili delicatamente alla crema.\n' +
      '5. Versa il caffè in una pirofila e lascialo raffreddare bene.\n' +
      '6. Passa velocemente i savoiardi nel caffè e disponili in uno strato sul fondo della teglia.\n' +
      '7. Copri con uno strato di crema, poi ripeti alternando savoiardi e crema.\n' +
      '8. Livella la superficie, copri e lascia riposare in frigorifero per almeno 3 ore.\n' +
      '9. Prima di servire spolvera con abbondante cacao amaro.'
  },
  'ricetta-spaghetti-al-tonno': {
    ingredients: [
      '320 g spaghetti',
      '160 g tonno sottolio sgocciolato',
      '2 spicchi di aglio',
      '400 g pomodori pelati o passata',
      'olio evo',
      'prezzemolo',
      'sale',
      'pepe'
    ],
    instructions:
      '1. In una padella scalda un filo di olio con gli spicchi di aglio schiacciati.\n' +
      '2. Aggiungi i pelati spezzettati o la passata, regola di sale e cuoci 10–12 minuti.\n' +
      '3. Unisci il tonno sgocciolato e sbriciolato, mescola e lascia insaporire pochi minuti.\n' +
      '4. Cuoci gli spaghetti in abbondante acqua salata.\n' +
      '5. Scola la pasta al dente e trasferiscila nella padella con il sugo.\n' +
      '6. Salta a fuoco vivo aggiungendo poca acqua di cottura se serve.\n' +
      '7. Completa con pepe e prezzemolo tritato.'
  },
  'ricetta-pasta-veloce-con-acciughe-e-mozzarella': {
    ingredients: [
      '320 g pasta corta',
      '200 g mozzarella ben scolata',
      '6 filetti di acciuga sottolio',
      '2 spicchi di aglio',
      'olio evo',
      'peperoncino',
      'prezzemolo',
      'sale'
    ],
    instructions:
      '1. Taglia la mozzarella a cubetti e lasciala sgocciolare.\n' +
      '2. Porta a bollore una pentola di acqua salata e cuoci la pasta.\n' +
      '3. In una padella scalda olio con aglio e peperoncino.\n' +
      '4. Aggiungi le acciughe e falle sciogliere a fuoco dolce.\n' +
      '5. Scola la pasta al dente, trasferiscila nella padella e mescola bene.\n' +
      '6. Fuori dal fuoco unisci la mozzarella e il prezzemolo tritato.\n' +
      '7. Mescola rapidamente e servi subito, prima che la mozzarella si rapprenda.'
  },
  'ricetta-pasta-al-forno-con-peperoni': {
    ingredients: [
      '350 g pasta corta',
      '2 peperoni',
      '200 g passata di pomodoro',
      '150 g mozzarella',
      '50 g parmigiano grattugiato',
      'olio evo',
      '1 spicchio di aglio',
      'sale',
      'pepe'
    ],
    instructions:
      '1. Taglia i peperoni a striscioline e falli rosolare in padella con olio e aglio.\n' +
      '2. Aggiungi la passata di pomodoro, sala e cuoci finché i peperoni sono morbidi.\n' +
      '3. Cuoci la pasta molto al dente in acqua salata.\n' +
      '4. Scola la pasta e condiscila con il sugo di peperoni.\n' +
      '5. Versa metà della pasta in una pirofila, aggiungi mozzarella a cubetti e una parte di parmigiano.\n' +
      '6. Copri con la pasta restante e completa con il parmigiano rimasto.\n' +
      '7. Cuoci in forno a 190°C per circa 20 minuti, finché la superficie è dorata.'
  },
  'ricetta-fave-e-cicoria': {
    ingredients: [
      '300 g fave secche decorticate',
      '500 g cicoria o catalogna',
      'olio evo',
      'sale',
      'pepe'
    ],
    instructions:
      '1. Sciacqua le fave e mettile in una pentola con acqua fredda.\n' +
      '2. Porta a bollore, abbassa la fiamma e cuoci finché le fave sono morbide, mescolando spesso.\n' +
      '3. Regola di sale e schiaccia con un mestolo fino a ottenere una purea liscia.\n' +
      '4. Pulisci la cicoria, lavala e lessala in acqua salata.\n' +
      '5. Scola la cicoria e ripassala in padella con olio caldo.\n' +
      '6. Servi la purea di fave con la cicoria sopra o accanto, completando con olio a crudo e pepe.'
  }
}

let updated = 0

for (const recipe of recipes) {
  const upd = updates[recipe.slug]
  if (!upd) continue

  if (upd.ingredients) {
    recipe.ingredients = upd.ingredients
  }
  if (upd.instructions) {
    recipe.instructions = upd.instructions
  }
  updated += 1
}

const outPath = new URL('../assets/json/recipes-it.enriched.top.json', import.meta.url)

const toWrite = Array.isArray(container)
  ? recipes
  : { ...container, recipes }

fs.writeFileSync(outPath, JSON.stringify(toWrite, null, 2), 'utf8')

console.log('Ricette aggiornate:', updated)
console.log('File scritto:', outPath.pathname)
