// ЗГЕНЕРОВАНО scripts/build-icons.mjs з src/food/svg/*.svg — не редагувати вручну.
// Щоб змінити іконку: правиш SVG і запускаєш генератор. Ліміт розміру файлу на згенероване не поширюється.
import type { ReactNode } from 'react';

export const FOOD_ICON_NAMES = [
  'alcohol',
  'banana',
  'berries',
  'borscht',
  'bread',
  'cake',
  'cereal',
  'cheese',
  'chocolate',
  'coffee',
  'cookies',
  'cottage_cheese',
  'dried_fruit',
  'dumplings',
  'eggs',
  'fast_food',
  'fish',
  'fruit',
  'ice_cream',
  'juice',
  'legumes',
  'meat',
  'milk',
  'nuts',
  'pancakes',
  'pasta',
  'pastry',
  'pizza',
  'plate',
  'porridge',
  'potatoes',
  'poultry',
  'protein_bar',
  'protein_shake',
  'salad',
  'sauce',
  'sausage',
  'seafood',
  'snacks',
  'soda',
  'soup',
  'tea',
  'toast',
  'vegetables',
  'yogurt',
] as const;

export type FoodIconName = (typeof FOOD_ICON_NAMES)[number];

export const FOOD_ICON_PATHS: Record<FoodIconName, ReactNode> = {
  'alcohol': (
    <>
      <path d="M6 9h15v16.5A2.5 2.5 0 0 1 18.5 28h-10A2.5 2.5 0 0 1 6 25.5z" fill="#F5B52E" stroke="#C9871F" strokeWidth="1.2" />
      <path d="M21 12h2.5a3 3 0 0 1 3 3v4a3 3 0 0 1-3 3H21" stroke="#C9871F" strokeWidth="2" fill="none" />
      <path d="M5 9.5c0-2.5 2-4 4-3.5 1-2 4-2 5 0 1.5-1 4.5-1 5 .5 2 0 3 1.5 3 3z" fill="#FFFFFF" stroke="#E2D2BE" strokeWidth="1.2" />
      <path d="M10 14v10M14 14v10M18 14v10" stroke="#FBD36A" strokeWidth="1.4" strokeLinecap="round" />
    </>
  ),
  'banana': (
    <>
      <path d="M4.5 8.5c8.5 0 19 4.5 23.5 15-8.5-1-19-5.5-23.5-15z" fill="#F7D24A" stroke="#D9B02B" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M7.5 10c5 1 12 4.5 16 11" stroke="#FBE58C" strokeWidth="1.4" strokeLinecap="round" fill="none" />
      <path d="M4.5 8.5l-1.3-3" stroke="#7A5A20" strokeWidth="1.8" strokeLinecap="round" />
    </>
  ),
  'berries': (
    <>
      <path d="M16 28c-6-3-10-9-9-14 .5-3 3.5-4.5 9-4.5s8.5 1.5 9 4.5c1 5-3 11-9 14z" fill="#E04A4A" stroke="#A8352A" strokeWidth="1.2" />
      <path d="M9.5 9.5c2-2.5 4.5-2 6.5 0 2-2 4.5-2.5 6.5 0-2 1.5-4.5 1.5-6.5 0-2 1.5-4.5 1.5-6.5 0z" fill="#5E9E43" />
      <path d="M16 9.5V5" stroke="#5E9E43" strokeWidth="1.6" strokeLinecap="round" />
      <g fill="#FFE08A">
      <circle cx="12" cy="15" r=".7" />
      <circle cx="16" cy="14" r=".7" />
      <circle cx="20" cy="15" r=".7" />
      <circle cx="13.5" cy="19" r=".7" />
      <circle cx="18.5" cy="19" r=".7" />
      <circle cx="16" cy="23" r=".7" />
      </g>
    </>
  ),
  'borscht': (
    <>
      <path d="M12 9c-1.5-1.5 1.5-2.5 0-4.5M17 8c-1.5-1.5 1.5-2.5 0-4.5" stroke="#DCCBB9" strokeWidth="1.4" strokeLinecap="round" fill="none" />
      <path d="M3.5 15h25a12.5 11 0 0 1-25 0z" fill="#FFFFFF" stroke="#E2C9B3" strokeWidth="1.2" />
      <ellipse cx="16" cy="15" rx="12.5" ry="2.2" fill="#C2334A" stroke="#E2C9B3" strokeWidth="1.2" />
      <path d="M14 14.6c0-1.6 4-1.6 4 0s-4 1.6-4 0z" fill="#FFFFFF" />
      <g fill="#5E9E43">
      <circle cx="11" cy="15" r=".9" />
      <circle cx="21" cy="14.8" r=".9" />
      <circle cx="19.5" cy="16" r=".7" />
      </g>
    </>
  ),
  'bread': (
    <>
      <path d="M3.5 20.5c0-6.5 5.5-11 12.5-11s12.5 4.5 12.5 11v3a2.5 2.5 0 0 1-2.5 2.5H6a2.5 2.5 0 0 1-2.5-2.5z" fill="#E0A15A" stroke="#A86C33" strokeWidth="1.2" />
      <path d="M10 13.5l2 3.5M15.5 12.5l2 3.5M21 13.5l2 3.5" stroke="#F5D29C" strokeWidth="1.8" strokeLinecap="round" />
    </>
  ),
  'cake': (
    <>
      <path d="M4 21l18-11 6 4v13H4z" fill="#F9E3C2" stroke="#D9B98A" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M4 21l18-11 6 4-24 7z" fill="#FFFFFF" stroke="#D9B98A" strokeWidth="1.2" strokeLinejoin="round" />
      <rect x="4" y="23.5" width="24" height="2.4" fill="#F7B3A2" />
      <circle cx="21.5" cy="8.5" r="2.3" fill="#D9534F" />
      <path d="M21.5 6.2c0-1.5.8-2.5 2-3" stroke="#5E9E43" strokeWidth="1.1" fill="none" strokeLinecap="round" />
    </>
  ),
  'cereal': (
    <>
      <path d="M3.5 15h25a12.5 11 0 0 1-25 0z" fill="#FFFFFF" stroke="#E2C9B3" strokeWidth="1.2" />
      <ellipse cx="16" cy="15" rx="12.5" ry="2.2" fill="#F4F7FB" stroke="#E2C9B3" strokeWidth="1.2" />
      <g fill="none" strokeWidth="2">
      <circle cx="10.5" cy="12" r="2" stroke="#F2A877" />
      <circle cx="16" cy="10.5" r="2" stroke="#F5C451" />
      <circle cx="21.5" cy="12" r="2" stroke="#E58A45" />
      <circle cx="13.5" cy="7.5" r="1.8" stroke="#F5C451" />
      <circle cx="19" cy="7" r="1.8" stroke="#F2A877" />
      </g>
    </>
  ),
  'cheese': (
    <>
      <path d="M3.5 21.5L24 8.5l4.5 5V24a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 24z" fill="#F5C451" stroke="#D99A2B" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M3.5 21.5h25" stroke="#D99A2B" strokeWidth="1.2" />
      <path d="M3.5 21.5L24 8.5l4.5 5h0" fill="#FBDB82" />
      <g fill="#E2A93A">
      <circle cx="9" cy="23.5" r="1.2" />
      <circle cx="17" cy="23" r="1.6" />
      <circle cx="24" cy="18" r="1.4" />
      <circle cx="19" cy="14.5" r="1" />
      </g>
    </>
  ),
  'chocolate': (
    <>
      <rect x="7" y="3.5" width="18" height="25" rx="2" fill="#7A4A2A" stroke="#4E2C17" strokeWidth="1.2" />
      <path d="M7 9.5h18M7 15.5h18M16 3.5v12" stroke="#4E2C17" strokeWidth="1.2" />
      <path d="M7 15h18v11.5a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2z" fill="#B9521A" stroke="#8F3E12" strokeWidth="1.2" />
      <path d="M7 15l3 2 3-2 3 2 3-2 3 2 3-2" stroke="#E2D2BE" strokeWidth="1.4" fill="none" strokeLinejoin="round" />
      <rect x="11" y="20.5" width="10" height="3.5" rx="1" fill="#FFF4E6" />
    </>
  ),
  'coffee': (
    <>
      <path d="M13 9c-1.5-1.5 1.5-2.5 0-4.5M18 8c-1.5-1.5 1.5-2.5 0-4.5" stroke="#DCCBB9" strokeWidth="1.4" strokeLinecap="round" fill="none" />
      <path d="M6 12h17v7.5a7 7 0 0 1-7 7h-3a7 7 0 0 1-7-7z" fill="#FFFFFF" stroke="#D9C2AE" strokeWidth="1.2" />
      <path d="M23 14h1.5a3 3 0 0 1 0 6H23" stroke="#D9C2AE" strokeWidth="1.8" fill="none" />
      <ellipse cx="14.5" cy="12.2" rx="8.2" ry="1.4" fill="#8B5A33" />
      <ellipse cx="16" cy="28.5" rx="11" ry="1.6" fill="#EADFD3" />
    </>
  ),
  'cookies': (
    <>
      <circle cx="16" cy="16" r="12" fill="#D9A55A" stroke="#A9773A" strokeWidth="1.2" />
      <g fill="#5E3215">
      <circle cx="11" cy="12" r="1.6" />
      <circle cx="18" cy="10.5" r="1.4" />
      <circle cx="21.5" cy="16.5" r="1.7" />
      <circle cx="14" cy="18" r="1.5" />
      <circle cx="18" cy="22" r="1.4" />
      <circle cx="10" cy="19.5" r="1.1" />
      </g>
    </>
  ),
  'cottage_cheese': (
    <>
      <path d="M3.5 15h25a12.5 11 0 0 1-25 0z" fill="#FFFFFF" stroke="#E2C9B3" strokeWidth="1.2" />
      <ellipse cx="16" cy="15" rx="12.5" ry="2.2" fill="#FFFFFF" stroke="#E2C9B3" strokeWidth="1.2" />
      <g fill="#FFFFFF" stroke="#D9CBB8" strokeWidth="1">
      <circle cx="11" cy="12.8" r="2.4" />
      <circle cx="15.5" cy="11.4" r="2.6" />
      <circle cx="20.5" cy="12.6" r="2.4" />
      <circle cx="13.2" cy="9.2" r="2" />
      <circle cx="18.4" cy="9" r="2" />
      </g>
      <circle cx="17" cy="7" r="1.6" fill="#E04A4A" />
    </>
  ),
  'dried_fruit': (
    <>
      <ellipse cx="11" cy="20" rx="6" ry="4" fill="#8B4E24" stroke="#5E3215" strokeWidth="1.2" transform="rotate(-25 11 20)" />
      <path d="M8.5 21c2-1.5 4-2 6-2" stroke="#B5743F" strokeWidth="1.2" strokeLinecap="round" fill="none" />
      <circle cx="21" cy="13" r="6" fill="#F0A04B" stroke="#C9762A" strokeWidth="1.2" />
      <path d="M18.5 10.5c1.5 1 1.5 4 0 5" stroke="#C9762A" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      <g fill="#5E3215">
      <circle cx="23" cy="23.5" r="1.8" />
      <circle cx="19.5" cy="25" r="1.6" />
      </g>
    </>
  ),
  'dumplings': (
    <>
      <path d="M3.5 21c0-7.5 5.5-12 12.5-12s12.5 4.5 12.5 12c0 1.3-1 2.3-2.3 2.3H5.8c-1.3 0-2.3-1-2.3-2.3z" fill="#FFF4E0" stroke="#D9BF95" strokeWidth="1.2" />
      <path d="M5.5 17c1-1.5 2.5-1.5 3 0 .6-1.8 2.4-1.8 3-.2.7-1.8 2.7-1.8 3.5-.2.8-1.6 2.8-1.6 3.5.2.7-1.6 2.5-1.6 3 .2.6-1.6 2.2-1.6 3 0" stroke="#D9BF95" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      <g fill="#7FBF5E">
      <circle cx="12" cy="20.5" r=".9" />
      <circle cx="17" cy="21" r=".9" />
      <circle cx="21.5" cy="20" r=".9" />
      </g>
    </>
  ),
  'eggs': (
    <>
      <path d="M5.5 17.5c-2.5-5.5 2-10.5 7.5-9.5 2.5-3.5 9-3 10.5 1.5 4 1.5 5 7 2.5 9.5 1 4.5-3.5 7.5-7.5 6-3 3-8.5 2-9.5-1.5-3 0-5-3-3.5-6z" fill="#FFFFFF" stroke="#E9D9B8" strokeWidth="1.2" />
      <circle cx="16" cy="16" r="5" fill="#F5B52E" />
      <circle cx="14.3" cy="14.3" r="1.5" fill="#FFE08A" />
    </>
  ),
  'fast_food': (
    <>
      <path d="M5 14a11 7 0 0 1 22 0z" fill="#E8A85A" stroke="#B06A2C" strokeWidth="1.2" />
      <g fill="#FFF4E6">
      <ellipse cx="11" cy="10.5" rx=".9" ry=".5" />
      <ellipse cx="16" cy="9" rx=".9" ry=".5" />
      <ellipse cx="21" cy="10.5" rx=".9" ry=".5" />
      </g>
      <path d="M4 15.5c2-1.5 3 1 5 0s3 1 5 0 3 1 5 0 3 1 5 0 3 1 4 0" stroke="#7FBF5E" strokeWidth="2.2" strokeLinecap="round" fill="none" />
      <rect x="4.5" y="17" width="23" height="4" rx="2" fill="#7A4A2A" />
      <rect x="5" y="16.4" width="22" height="1.6" fill="#F5C451" />
      <path d="M5 22.5h22v1.5a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3z" fill="#E8A85A" stroke="#B06A2C" strokeWidth="1.2" />
    </>
  ),
  'fish': (
    <>
      <path d="M3.5 16c4-6 12-8.5 18.5-4l6-4v16l-6-4c-6.5 4.5-14.5 2-18.5-4z" fill="#8FB8D8" stroke="#4F7FA6" strokeWidth="1.2" strokeLinejoin="round" />
      <circle cx="9.5" cy="14.5" r="1.4" fill="#2B1D14" />
      <path d="M14 12.5c1.5 2 1.5 5 0 7" stroke="#4F7FA6" strokeWidth="1.2" fill="none" strokeLinecap="round" />
    </>
  ),
  'fruit': (
    <>
      <path d="M16 9c-5-3-11.5 0-11.5 7 0 6 4.5 11.5 8.5 11 1.5-.3 2-.8 3-.8s1.5.5 3 .8c4 .5 8.5-5 8.5-11 0-7-6.5-10-11.5-7z" fill="#E0503F" stroke="#A8352A" strokeWidth="1.2" />
      <path d="M16 9c0-2.5 1-4.5 2.5-5.5" stroke="#7A5A2A" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <path d="M17.5 7c1-3 4.5-4 6.5-3-1 3-4 4-6.5 3z" fill="#7FBF5E" />
      <path d="M9 14c.5-2 2-3 3.5-3.2" stroke="#F49A8E" strokeWidth="1.6" strokeLinecap="round" fill="none" />
    </>
  ),
  'ice_cream': (
    <>
      <path d="M9.5 15h13L16 29z" fill="#E8A85A" stroke="#B06A2C" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M11.5 17.5l7 6M15 15.5l5.5 5M18 17l-5.5 5M21 16l-7.5 7" stroke="#C98340" strokeWidth="1" strokeLinecap="round" />
      <path d="M8.5 15.5a7.5 7.5 0 0 1 15 0c0 1-1 1.5-2 1-1 1-2.5 1-3.5 0-1 1-3 1-4 0-1 1-2.5 1-3.5 0-1 .5-2 0-2-1z" fill="#F7B3A2" stroke="#E08A78" strokeWidth="1.2" />
      <circle cx="16" cy="6.5" r="1.8" fill="#D9534F" />
    </>
  ),
  'juice': (
    <>
      <path d="M8 8h16l-2 19a1.5 1.5 0 0 1-1.5 1.3h-9A1.5 1.5 0 0 1 10 27z" fill="#FFFFFF" stroke="#D9C2AE" strokeWidth="1.2" />
      <path d="M8.7 13h14.6l-1.5 14h-11.6z" fill="#F5A13C" />
      <path d="M19 13l4-10" stroke="#E04A4A" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="9" cy="8" r="4" fill="#F5C451" stroke="#E2A23A" strokeWidth="1.2" />
      <path d="M9 4.5v7M5.5 8h7" stroke="#E2A23A" strokeWidth=".8" />
    </>
  ),
  'legumes': (
    <>
      <path d="M3.5 15h25a12.5 11 0 0 1-25 0z" fill="#FFFFFF" stroke="#E2C9B3" strokeWidth="1.2" />
      <ellipse cx="16" cy="15" rx="12.5" ry="2.2" fill="#E8D3B0" stroke="#E2C9B3" strokeWidth="1.2" />
      <g stroke="#8E3B30" strokeWidth=".8">
      <ellipse cx="10.5" cy="13.5" rx="2" ry="1.3" fill="#B5532E" />
      <ellipse cx="15" cy="12.2" rx="2" ry="1.3" fill="#E8C47A" stroke="#B48A3A" />
      <ellipse cx="19.5" cy="13.3" rx="2" ry="1.3" fill="#B5532E" />
      <ellipse cx="13" cy="15" rx="2" ry="1.3" fill="#E8C47A" stroke="#B48A3A" />
      <ellipse cx="22.5" cy="14.8" rx="1.8" ry="1.2" fill="#B5532E" />
      </g>
    </>
  ),
  'meat': (
    <>
      <path d="M6.5 10.5c4-4.5 14-4.5 18.5 1 3.5 4.5 2 12-4.5 14-5.5 2-13 1-15-4.5-1.5-4-2-7.5 1-10.5z" fill="#C0584A" stroke="#8E3B30" strokeWidth="1.2" />
      <path d="M9 17c3-3 9-3.5 13 0" stroke="#F7D3C8" strokeWidth="1.6" strokeLinecap="round" fill="none" />
      <circle cx="21.5" cy="12.5" r="2.4" fill="#FFF4E6" stroke="#E2C9B3" strokeWidth="1" />
    </>
  ),
  'milk': (
    <>
      <path d="M11 4.5h10v4l3 4V27a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 8 27V12.5l3-4z" fill="#FFFFFF" stroke="#B7CBE0" strokeWidth="1.2" strokeLinejoin="round" />
      <rect x="11" y="3" width="10" height="3.5" rx="1" fill="#5B8DBF" />
      <rect x="8" y="15.5" width="16" height="7" fill="#8FB8D8" />
      <path d="M12 19c1.5-1.5 3-1.5 4 0s2.5 1.5 4 0" stroke="#FFFFFF" strokeWidth="1.3" fill="none" strokeLinecap="round" />
    </>
  ),
  'nuts': (
    <>
      <path d="M9.5 7c4 0 6 4.5 5 9.5s-3 9.5-5 9.5-4-4.5-5-9.5 1-9.5 5-9.5z" fill="#C98A4B" stroke="#8E5626" strokeWidth="1.2" />
      <path d="M9.5 9.5c-1.5 3-1.5 9 0 14" stroke="#A86C33" strokeWidth="1" fill="none" strokeLinecap="round" />
      <path d="M22 8c4 0 6 4 5 8.5s-3 8.5-5 8.5-4-4-5-8.5 1-8.5 5-8.5z" fill="#D9A065" stroke="#8E5626" strokeWidth="1.2" transform="rotate(15 22 16)" />
      <path d="M19.5 12.5c1 1 1.5 1 3 .5M20 17c1 1 2 1 3.5.3" stroke="#A86C33" strokeWidth="1" fill="none" strokeLinecap="round" />
    </>
  ),
  'pancakes': (
    <>
      <ellipse cx="16" cy="24" rx="12" ry="3.4" fill="#D98E45" stroke="#B06A2C" strokeWidth="1.2" />
      <ellipse cx="16" cy="19.5" rx="12" ry="3.4" fill="#E8A85A" stroke="#B06A2C" strokeWidth="1.2" />
      <ellipse cx="16" cy="15" rx="12" ry="3.4" fill="#F0BC72" stroke="#B06A2C" strokeWidth="1.2" />
      <path d="M9 15.5c2 1 4 0 5 2.5 1 2.5 3 1 3-1 2 1 5 0 6-2" stroke="#B9521A" strokeWidth="1.8" strokeLinecap="round" fill="none" />
      <rect x="13.5" y="10.5" width="5" height="4" rx="1" fill="#FFE08A" stroke="#E2B94A" strokeWidth="1" />
    </>
  ),
  'pasta': (
    <>
      <ellipse cx="16" cy="19" rx="13" ry="8" fill="#FFFFFF" stroke="#E2C9B3" strokeWidth="1.2" />
      <path d="M9 18c2-5 12-6 14-1-3-3-10-3-11 1 1-3 7-3 8 0-2-1-4-1-5 1" stroke="#F5C451" strokeWidth="2.2" strokeLinecap="round" fill="none" />
      <circle cx="16.5" cy="18" r="2.8" fill="#D9534F" />
      <path d="M20 21.5c1.5-1.5 3.5-1 4 0-1.5 1.5-3 1.2-4 0z" fill="#5E9E43" />
    </>
  ),
  'pastry': (
    <>
      <path d="M3.5 21c1.5-7.5 7-12 12.5-12s11 4.5 12.5 12c-2.5-1.8-5-1.8-7 .2-1.6-2.4-7.4-2.4-9 0-2-2-4.5-2-9-.2z" fill="#E8A85A" stroke="#A86C33" strokeWidth="1.2" />
      <path d="M11 12.5l2.5 8M16 10l0 10M21 12.5l-2.5 8" stroke="#B87735" strokeWidth="1.2" strokeLinecap="round" />
    </>
  ),
  'pizza': (
    <>
      <path d="M5 8.5c7.5-2.5 15.5-1.5 22.5 3L14 28z" fill="#F5C451" stroke="#D99A2B" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M5 8.5c7.5-2.5 15.5-1.5 22.5 3" stroke="#C97F3A" strokeWidth="3.2" strokeLinecap="round" fill="none" />
      <g fill="#D9534F">
      <circle cx="13" cy="14" r="2.2" />
      <circle cx="19.5" cy="14.5" r="2" />
      <circle cx="14.5" cy="20.5" r="1.8" />
      </g>
    </>
  ),
  'plate': (
    <>
      <circle cx="16" cy="16" r="11" fill="#FFFFFF" stroke="#D9C2AE" strokeWidth="1.2" />
      <circle cx="16" cy="16" r="7" fill="none" stroke="#EADFD3" strokeWidth="1.2" />
      <path d="M3 6v6M5 6v6M4 12v14" stroke="#B7A898" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M28.5 5.5c-2 1-2.5 4-2.5 7.5h2.5V27" stroke="#B7A898" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </>
  ),
  'porridge': (
    <>
      <path d="M3.5 15h25a12.5 11 0 0 1-25 0z" fill="#FFFFFF" stroke="#E2C9B3" strokeWidth="1.2" />
      <path d="M5.5 15.2c1.5-4 5.5-6 10.5-6s9 2 10.5 6z" fill="#C98A4B" stroke="#A86C33" strokeWidth="1.2" />
      <g fill="#8E5626">
      <circle cx="11" cy="12.5" r=".9" />
      <circle cx="15" cy="11" r=".9" />
      <circle cx="19" cy="12" r=".9" />
      <circle cx="22" cy="13.6" r=".9" />
      <circle cx="13" cy="14" r=".9" />
      <circle cx="17.5" cy="14" r=".9" />
      </g>
    </>
  ),
  'potatoes': (
    <>
      <ellipse cx="12" cy="19" rx="8.5" ry="6.5" fill="#D9A55A" stroke="#A9773A" strokeWidth="1.2" transform="rotate(-15 12 19)" />
      <ellipse cx="21.5" cy="14" rx="7" ry="5.5" fill="#E3B46A" stroke="#A9773A" strokeWidth="1.2" transform="rotate(20 21.5 14)" />
      <g fill="#A9773A">
      <circle cx="9" cy="18" r=".8" />
      <circle cx="13.5" cy="21" r=".8" />
      <circle cx="20" cy="12.5" r=".8" />
      <circle cx="23.5" cy="15.5" r=".8" />
      </g>
    </>
  ),
  'poultry': (
    <>
      <path d="M20.5 3.5c5 0 8 4 8 8.5 0 5.5-5.5 9-10.5 7l-5.5 5.5-3-3 5.5-5.5c-2-5.5 1-12.5 5.5-12.5z" fill="#D9894A" stroke="#A65F2A" strokeWidth="1.2" />
      <path d="M23 7c1.5.8 2.5 2.3 2.5 4" stroke="#F2B987" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <circle cx="6.5" cy="25" r="2.3" fill="#FFF4E6" stroke="#E2C9B3" strokeWidth="1" />
      <circle cx="9" cy="27.5" r="2.1" fill="#FFF4E6" stroke="#E2C9B3" strokeWidth="1" />
    </>
  ),
  'protein_bar': (
    <>
      <rect x="3" y="11" width="26" height="10" rx="2.5" fill="#B9521A" stroke="#8F3E12" strokeWidth="1.2" transform="rotate(-12 16 16)" />
      <rect x="4.5" y="12.5" width="7" height="7" rx="1" fill="#6B3A1E" transform="rotate(-12 16 16)" />
      <path d="M14 17.5l9-2" stroke="#FFF4E6" strokeWidth="2" strokeLinecap="round" />
    </>
  ),
  'protein_shake': (
    <>
      <path d="M9 9h14l-1.5 18a1.5 1.5 0 0 1-1.5 1.4h-8A1.5 1.5 0 0 1 10.5 27z" fill="#FFFFFF" stroke="#B7CBE0" strokeWidth="1.2" />
      <path d="M9.8 15h12.4l-1 11.5h-10.4z" fill="#C9A27A" />
      <rect x="8" y="5" width="16" height="4.5" rx="1.5" fill="#2A2118" />
      <rect x="13.5" y="2.5" width="5" height="3" rx="1" fill="#2A2118" />
      <rect x="12" y="18" width="8" height="4" rx="1" fill="#FFF4E6" />
    </>
  ),
  'salad': (
    <>
      <path d="M3.5 15h25a12.5 11 0 0 1-25 0z" fill="#FFFFFF" stroke="#E2C9B3" strokeWidth="1.2" />
      <path d="M5 15.5c0-3 3-5 5-3.5 0-3 4-4.5 6-2 2-2.5 6-1 6 2 2.5-1 5 1.5 5 3.5z" fill="#7FBF5E" stroke="#4E8A35" strokeWidth="1.2" />
      <circle cx="12.5" cy="12.5" r="2.4" fill="#E0503F" />
      <circle cx="20" cy="12.8" r="2.2" fill="#C9E4A6" stroke="#4E8A35" strokeWidth="1" />
    </>
  ),
  'sauce': (
    <>
      <path d="M12 3.5h8v3h-8z" fill="#E2D2BE" />
      <path d="M13.5 6.5h5l1.5 3.5H12z" fill="#FFFFFF" stroke="#D9C2AE" strokeWidth="1" />
      <path d="M10 11a2 2 0 0 1 2-1.5h8a2 2 0 0 1 2 1.5l1 14.5A2.5 2.5 0 0 1 20.5 28h-9A2.5 2.5 0 0 1 9 25.5z" fill="#D9534F" stroke="#A8352A" strokeWidth="1.2" />
      <rect x="11.5" y="16" width="9" height="6" rx="1" fill="#FFF4E6" />
      <path d="M14 19h4" stroke="#D9534F" strokeWidth="1.4" strokeLinecap="round" />
    </>
  ),
  'sausage': (
    <>
      <path d="M6 19c4 5.5 16 5.5 20.5-6" stroke="#8E3B30" strokeWidth="9" strokeLinecap="round" fill="none" />
      <path d="M6 19c4 5.5 16 5.5 20.5-6" stroke="#C0584A" strokeWidth="6.6" strokeLinecap="round" fill="none" />
      <path d="M9 19.5c3 2.5 9 2.5 12.5-1.5" stroke="#E58B7E" strokeWidth="1.6" strokeLinecap="round" fill="none" />
    </>
  ),
  'seafood': (
    <>
      <circle cx="16" cy="16" r="11.5" fill="#2F3B33" />
      <circle cx="16" cy="16" r="9" fill="#FFFFFF" />
      <circle cx="16" cy="16" r="4.2" fill="#F08A5D" />
      <path d="M14 14.5l4 3M14.3 17.5l3.5-2.5" stroke="#FFD2BC" strokeWidth="1" strokeLinecap="round" />
      <g fill="#F2E6D8">
      <circle cx="10" cy="13" r=".8" />
      <circle cx="21.5" cy="19.5" r=".8" />
      <circle cx="20" cy="11" r=".8" />
      </g>
    </>
  ),
  'snacks': (
    <>
      <path d="M8 5h16l-1.5 3 1.5 3v14l1.5 2.5h-19L8 25V11l1.5-3z" fill="#F5C451" stroke="#D99A2B" strokeWidth="1.2" strokeLinejoin="round" />
      <rect x="8" y="12" width="16" height="7" fill="#D9534F" />
      <path d="M12 15.5c1.5-1.5 3-1.5 4 0s2.5 1.5 4 0" stroke="#FFFFFF" strokeWidth="1.4" fill="none" strokeLinecap="round" />
    </>
  ),
  'soda': (
    <>
      <rect x="8.5" y="5" width="15" height="23" rx="3" fill="#D9534F" stroke="#A8352A" strokeWidth="1.2" />
      <rect x="8.5" y="5" width="15" height="3" rx="1.5" fill="#C9C2BA" stroke="#A89E92" strokeWidth="1" />
      <path d="M11 14c2 1.5 8 1.5 10-1M11 19c2 1.5 8 1.5 10-1" stroke="#FFFFFF" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      <g fill="#FFFFFF" opacity=".7">
      <circle cx="13" cy="23.5" r=".9" />
      <circle cx="18" cy="24.5" r=".7" />
      </g>
    </>
  ),
  'soup': (
    <>
      <path d="M12 9c-1.5-1.5 1.5-2.5 0-4.5M17 8c-1.5-1.5 1.5-2.5 0-4.5" stroke="#DCCBB9" strokeWidth="1.4" strokeLinecap="round" fill="none" />
      <path d="M3.5 15h25a12.5 11 0 0 1-25 0z" fill="#FFFFFF" stroke="#E2C9B3" strokeWidth="1.2" />
      <ellipse cx="16" cy="15" rx="12.5" ry="2.2" fill="#F2B544" stroke="#E2C9B3" strokeWidth="1.2" />
      <circle cx="11.5" cy="15" r="1.3" fill="#E77B3C" />
      <circle cx="19" cy="14.6" r="1.2" fill="#7FBF5E" />
      <path d="M14.5 15h3" stroke="#FFF1C9" strokeWidth="1.6" strokeLinecap="round" />
    </>
  ),
  'tea': (
    <>
      <path d="M6 12h17v7.5a7 7 0 0 1-7 7h-3a7 7 0 0 1-7-7z" fill="#FFFFFF" stroke="#D9C2AE" strokeWidth="1.2" />
      <path d="M23 14h1.5a3 3 0 0 1 0 6H23" stroke="#D9C2AE" strokeWidth="1.8" fill="none" />
      <ellipse cx="14.5" cy="12.2" rx="8.2" ry="1.4" fill="#D9893A" />
      <path d="M17 12V6.5" stroke="#B7A898" strokeWidth="1" />
      <rect x="15" y="3" width="4" height="4" rx=".6" fill="#7FBF5E" />
      <ellipse cx="16" cy="28.5" rx="11" ry="1.6" fill="#EADFD3" />
    </>
  ),
  'toast': (
    <>
      <path d="M8 27V14c-3.5-1-3.5-8.5 2.5-9h11c6 .5 6 8 2.5 9v13z" fill="#C98A4B" stroke="#A06A33" strokeWidth="1.2" />
      <path d="M10 25V13.5c-2.2-.8-2-6 1.5-6.3h9c3.5.3 3.7 5.5 1.5 6.3V25z" fill="#F7D9A3" />
      <path d="M11.5 17.5c2-2 7-2 9 0-1 4-8 4-9 0z" fill="#8DBE5A" />
      <circle cx="16" cy="17.6" r="1.6" fill="#7A5A2A" />
    </>
  ),
  'vegetables': (
    <>
      <path d="M7 27l9.5-12.5-3-3z" fill="#F08A3C" stroke="#C9631F" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M14.5 12.5c-.5-3 1-4.5 3-3.5-.5-2 1.5-3 3-1.5" stroke="#5E9E43" strokeWidth="1.8" strokeLinecap="round" fill="none" />
      <path d="M20 28v-7" stroke="#9CC57A" strokeWidth="3" strokeLinecap="round" />
      <g fill="#5E9E43" stroke="#3F7A2C" strokeWidth="1">
      <circle cx="17.5" cy="18" r="3.3" />
      <circle cx="22.5" cy="17.5" r="3.5" />
      <circle cx="20" cy="14.5" r="3.3" />
      </g>
    </>
  ),
  'yogurt': (
    <>
      <path d="M6.5 11h19l-2.2 15.5A2 2 0 0 1 21.3 28H10.7a2 2 0 0 1-2-1.5z" fill="#FFFFFF" stroke="#B7CBE0" strokeWidth="1.2" />
      <rect x="5.5" y="8" width="21" height="3.5" rx="1.5" fill="#F7B3A2" stroke="#E08A78" strokeWidth="1.2" />
      <path d="M8 16.5h16l-.8 5.5H8.8z" fill="#F7B3A2" />
      <circle cx="16" cy="19" r="1.6" fill="#E04A4A" />
    </>
  ),
};
