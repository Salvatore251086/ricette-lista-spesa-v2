import { readFile, writeFile } from 'fs/promises'
import path from 'path'

const filePath = path.join(process.cwd(), 'assets', 'json', 'recipes-it.json')

const instructionsBySlug = {
  'spaghetti-alle-vongole-e-bottarga-di-tonno':
    "Metti a bagno le vongole in acqua fredda leggermente salata per 20-30 minuti.\nPorta a bollore l'acqua per la pasta e sala.\nIn una padella scalda olio, aglio e poco peperoncino, aggiungi le vongole scolate e sfuma con vino bianco.\nCopri finché le vongole si aprono, poi togli dal fuoco e filtra il fondo di cottura.\nCuoci gli spaghetti molto al dente, trasferiscili in padella con il fondo filtrato e salta aggiungendo poca acqua di cottura.\nSpegni il fuoco, unisci bottarga grattugiata e prezzemolo tritato, mescola e servi subito.",

  'lasagne-ricotta-pomodoro-e-spinaci':
    "Accendi il forno a 180°C.\nSbollenta per 1 minuto i fogli di lasagna se sono secchi, poi scolali su un canovaccio.\nIn una ciotola mescola ricotta, spinaci già cotti e tritati, sale, pepe e poco formaggio grattugiato.\nStendi sul fondo della teglia un velo di salsa di pomodoro.\nFai gli strati: pasta, crema di ricotta e spinaci, pomodoro e formaggio grattugiato.\nTermina con pomodoro e formaggio in superficie.\nInforna per 25-30 minuti finché la superficie è dorata.\nLascia riposare 5-10 minuti prima di tagliare le porzioni.",

  'lasagnette-con-ragu-di-agnello-e-olive':
    "Prepara il ragù rosolando in casseruola cipolla, carota e sedano tritati in poco olio.\nAggiungi la carne di agnello a pezzetti, fai rosolare bene e sfuma con vino.\nUnisci passata di pomodoro, qualche oliva, sale e pepe, cuoci a fuoco basso finché il sugo è denso.\nLessi le lasagnette in acqua salata, scolale molto al dente.\nCondisci la pasta con il ragù tenendo da parte un po' di sugo.\nSistema in teglia alternando pasta, ragù e formaggio grattugiato.\nPassa in forno caldo per 10-15 minuti per gratinare leggermente e servi.",

  'pasta-all-amatriciana-con-variazioni':
    "Metti a bollire l'acqua per la pasta e sala.\nIn una padella fai rosolare il guanciale a listarelle partendo a freddo, finché diventa dorato.\nTogli parte del grasso se è troppo, poi unisci il pomodoro e un pizzico di peperoncino.\nCuoci il sugo per 10-15 minuti regolando di sale.\nCuoci la pasta al dente, trasferiscila nella padella con il sugo.\nSalta a fuoco vivo con un po' di acqua di cottura.\nSpegni il fuoco, aggiungi abbondante pecorino grattugiato, manteca e servi subito.",

  'maccheroncini-con-carbonara-alla-majonese':
    "Metti a bollire l'acqua per la pasta e sala.\nIn una padella rosola dolcemente pancetta o guanciale a cubetti finché è croccante.\nIn una ciotola mescola tuorli, un cucchiaio di maionese, formaggio grattugiato e poco pepe nero.\nCuoci i maccheroncini al dente.\nScola la pasta tenendo da parte un po' di acqua di cottura, versa nella padella con il grasso del guanciale.\nTogli la padella dal fuoco, aggiungi la crema di uova e maionese e manteca velocemente.\nRegola la consistenza con un filo di acqua di cottura, completa con altro pepe e servi subito.",

  'ricetta-carbonara-di-pesce':
    "Porta a bollore l'acqua per la pasta e sala.\nTaglia il pesce a dadini piccoli e asciugalo bene con carta da cucina.\nIn una padella scalda olio con uno spicchio d'aglio, rosola il pesce per pochi minuti e tienilo da parte.\nIn una ciotola mescola tuorli, formaggio grattugiato, sale leggero e pepe.\nCuoci la pasta al dente, trasferiscila in padella con il fondo di cottura del pesce.\nTogli dal fuoco, aggiungi la crema di uova e mescola rapidamente.\nUnisci il pesce, manteca con poca acqua di cottura se serve e servi subito con altro pepe.",

  'maccheroni-alla-chitarra-con-polpette':
    "Prepara l'impasto delle polpette mescolando carne macinata, uovo, pane ammollato nel latte, sale, pepe e formaggio.\nForma polpettine piccole e falle rosolare in padella con poco olio.\nAggiungi passata di pomodoro, un filo d'acqua e cuoci a fuoco basso finché il sugo è morbido e le polpette cotte.\nMetti a bollire l'acqua per la pasta e sala.\nCuoci i maccheroni alla chitarra al dente.\nCondisci la pasta con il sugo di pomodoro, tenendo le polpette intere per la superficie.\nServi la pasta con le polpette sopra e una spolverata di formaggio grattugiato.",

  'pollo-in-crosta-di-sale':
    "Accendi il forno a 190-200°C.\nMescola in una ciotola grande il sale grosso con albume e qualche erba aromatica tritata.\nSistema uno strato di sale sul fondo della teglia, appoggia sopra il pollo intero già condito con pepe ed erbe.\nCopri completamente il pollo con il resto del sale, compattando con le mani.\nInforna per circa 60-75 minuti a seconda della grandezza del pollo.\nLascia riposare 10 minuti fuori dal forno.\nRompi la crosta di sale con un coltello, elimina il sale in eccesso, porziona il pollo e servi con olio crudo e contorno a piacere.",

  'risotto-porri-zucca-salmone-nocciole':
    "Taglia a rondelle i porri e a cubetti piccoli la zucca.\nIn casseruola fai appassire i porri in poco olio o burro, aggiungi la zucca e rosola qualche minuto.\nUnisci il riso e tostalo mescolando per 1-2 minuti.\nBagna con vino bianco, lascia evaporare, poi porta a cottura aggiungendo brodo caldo poco per volta.\nA metà cottura unisci il salmone a pezzetti.\nQuando il riso è al dente, spegni il fuoco e manteca con poco burro e formaggio se gradisci.\nCompleta nei piatti con nocciole tostate tritate e una macinata di pepe.",

  'caprese-di-mozzarella-di-bufala':
    "Taglia i pomodori a fette regolari e lasciali sgocciolare qualche minuto.\nAffetta la mozzarella di bufala e asciugala delicatamente con carta da cucina.\nAlterna in un piatto grande fette di pomodoro e mozzarella creando una corona.\nCondisci con sale, pepe e olio extravergine di oliva.\nAggiungi foglie di basilico spezzate con le mani poco prima di servire.\nSe vuoi, completa con un filo di aceto balsamico o scorza di limone grattugiata per dare freschezza."
}

async function main() {
  const original = await readFile(filePath, 'utf8')
  const data = JSON.parse(original)

  const recipesArray = Array.isArray(data) ? data : data.recipes
  if (!Array.isArray(recipesArray)) {
    console.error('Formato recipes-it.json inatteso')
    return
  }

  let updatedCount = 0

  for (const r of recipesArray) {
    if (!r || !r.slug) continue
    const instr = instructionsBySlug[r.slug]
    if (!instr) continue
    r.instructions = instr
    updatedCount++
  }

  // backup
  await writeFile(filePath + '.backup_instructions', original, 'utf8')

  if (Array.isArray(data)) {
    await writeFile(filePath, JSON.stringify(recipesArray, null, 2) + '\n', 'utf8')
  } else {
    data.recipes = recipesArray
    await writeFile(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8')
  }

  console.log('Aggiornate', updatedCount, 'ricette con instructions')
}

main().catch(err => {
  console.error('Errore script update_instructions', err)
})
