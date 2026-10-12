'use client'

import React from 'react'
import {
  Apple, Baby, Banana, Beef, Beer, Cake, CakeSlice, Candy, ChefHat, Cherry, Citrus, Coffee, Cookie, CookingPot,
  Croissant, CupSoda, Droplets, Drumstick, Egg, EggFried, Fish, Flame, GlassWater, Globe, Ham, HandPlatter,
  IceCreamCone, Leaf, Martini, Milk, Nut, Pizza, Popcorn, Salad, Sandwich, Snowflake, Soup, Sparkles, Sprout,
  Utensils, UtensilsCrossed, Vegan, Wheat, Wine, Zap, type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

/** Katalog kategorilerinde kullanılan lucide ikonları (catalog_categories.icon kebab-case adları) */
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  apple: Apple, baby: Baby, banana: Banana, beef: Beef, beer: Beer, cake: Cake, 'cake-slice': CakeSlice,
  candy: Candy, 'chef-hat': ChefHat, cherry: Cherry, citrus: Citrus, coffee: Coffee, cookie: Cookie,
  'cooking-pot': CookingPot, croissant: Croissant, 'cup-soda': CupSoda, droplets: Droplets, drumstick: Drumstick,
  egg: Egg, 'egg-fried': EggFried, fish: Fish, flame: Flame, 'glass-water': GlassWater, globe: Globe, ham: Ham,
  'hand-platter': HandPlatter, 'ice-cream-cone': IceCreamCone, leaf: Leaf, martini: Martini, milk: Milk, nut: Nut,
  pizza: Pizza, popcorn: Popcorn, salad: Salad, sandwich: Sandwich, snowflake: Snowflake, soup: Soup,
  sparkles: Sparkles, sprout: Sprout, utensils: Utensils, 'utensils-crossed': UtensilsCrossed, vegan: Vegan,
  wheat: Wheat, wine: Wine, zap: Zap,
}

export function CategoryIcon({ name, className }: { name?: string | null; className?: string }) {
  const Icon = (name && CATEGORY_ICONS[name]) || Utensils
  return <Icon className={cn('h-4 w-4', className)} />
}

export function IconPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="grid max-h-40 grid-cols-9 gap-1 overflow-y-auto rounded-2xl border border-border/60 p-2">
      <button
        type="button"
        onClick={() => onChange('')}
        className={cn('rounded-lg p-1.5 text-[10px] text-muted-foreground hover:bg-accent', !value && 'bg-primary text-primary-foreground')}
        title="İkon yok"
      >
        —
      </button>
      {Object.entries(CATEGORY_ICONS).map(([name, Icon]) => (
        <button
          key={name}
          type="button"
          title={name}
          onClick={() => onChange(name)}
          className={cn('flex items-center justify-center rounded-lg p-1.5 hover:bg-accent', value === name && 'bg-primary text-primary-foreground')}
        >
          <Icon className="h-4 w-4" />
        </button>
      ))}
    </div>
  )
}
