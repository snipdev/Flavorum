/**
 * Format a recipe into a clean, human-readable text block for sharing/clipboard.
 */
export function formatRecipeText(recipe) {
  if (!recipe) return ''
  let text = `🧪 ${recipe.name}\n`
  if (recipe.source) text += `📌 ${recipe.source}\n`
  text += `───────────────\n`
  if (Array.isArray(recipe.flavors) && recipe.flavors.length > 0) {
    recipe.flavors.forEach(f => {
      text += `• ${f.name}: ${f.value}%\n`
    })
  } else {
    text += `No flavors specified\n`
  }
  text += `───────────────\n`
  text += `Made with Flavorum 🍃`
  return text
}
