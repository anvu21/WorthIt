# Google Maps closure check — 2026-11-04

Each open place (297) was searched on Google Maps as "name, address", and the status in the place header was read. Nothing else (coordinates, ratings) was taken from Google.

| Result | Count | Action |
|---|---|---|
| Permanently closed | 46 | Marked `yes` in Map → **Permanently Closed** (column Q) |
| Open | 210 | None |
| Temporarily closed | 3 | None (left open) |
| Several results / no single match | 38 | Second pass by name + city; see below |

Earlier the same day: **gubami** was confirmed closed and marked.

## Marked permanently closed (46)

Name in the sheet → name Google showed.

All Day Baby · Angler (Angler Los Angeles) · APL (APL Restaurant) · Bang Bang Noodles (Culver City) · Barton G. · Breakfast by Salt's Cure · Burger Brasserie · Burgerlords · Cafe Sbisa · Cha for Tea · Cirrus (Cirrus Dining) · Connie and Ted's · District One Kitchen & Bar · Doyle's Oyster Bar (Doyles at Sydney Fish Markets) · El Cochinito · Feast Buffet · Freedman's · Fuku (Fuku at Kitchen United MIX) · Gish Bac · Greem Cafe · Jeepney · Kogi Taqueria · Lady of the House · Le Petit Paris · Lov · Lukshon · Mah-Ze-Dahr Bakery · Mija Barbecue · Pajarito · Petit Crenn · Pho Binh By Night · Picnic Society · Revival (Revival MPLS) · Rinrin (Rin Rin) · Rosaliné · Rose. Rabbit. Lie · Saraba Garifuna Cuisine · Son of a Gun · Spoon by H · Sushi Dokoro Shun · Tesse · The Pie Hole · The Sterling Brunch · Top Round Roast Beef · Vicious Dogs · WOODSPOON

To undo any of these, clear its `yes` in column Q and re-run the importer.

## Temporarily closed — not marked

Hankook Tongdak · OO-KOOK · Showa Ice. The second pass also showed Silks and So Deul Nyuk as temporarily closed.

## Possibly closed — please check (not marked)

From the name + city pass, which is less reliable than the address search:

| Sheet | Google matched | Note |
|---|---|---|
| Low Key Burritos | Lowkey Burrito | Probably the same place |
| Pacific Seas @ Clifton's | The Pacific Seas | Probably the same place |
| Ricky's Fish Tacos | Ricky's Fish Tacos | Same name; address not confirmed |
| Ahi Assassins | HookedOnline by Ahi Assassins | May be a related but different business |
| Seasoned Vegan | Seasoned Vegan Real Quick | Possibly a different location or concept |
| Barzotto | Barzotto North Beach | Sheet is the Valencia St location, so likely a different branch |

Wrong matches, ignored: Kogi Truck → Kogi Taqueria, Chef Mavro → MW Restaurant, Lao Tao → TAO, Lee Kang Soon Silbi House → a guesthouse.

## Still unresolved (Google returned several results)

A Yu Beef Shabu Shabu · Belly · Buc-ee's · CUT · Din Tai Fung · Gangnam Galmegi · Imganae Dwitgogi · Kura Sushi · Lao Xi'er Noodle House · Maccha House Kiyomizu-Dera · MY AME · Namdaemun Market Hotteok · Nash Pit · Nikko Masuzushi Honpo · Poutineville · Saucy Chick Rotisserie · Yan Xiang Lou · £10 @ The Montage Hotel

## Name differences worth a look

- **Lasa** is now listed on Google as **Lasita** at the same address (open).
- **Pizzaria Mozza** / **Pizzeria Mozza** and **Porto's Bakery** / **Porto's Bakery & Cafe** each resolve to one place: these are duplicate rows.
