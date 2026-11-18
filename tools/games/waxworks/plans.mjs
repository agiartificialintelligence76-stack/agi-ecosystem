/*
  A depot's hand-blocked route is carved into a literal shipping floor by bake.
  The raised route is also the designer's fallback witness. A space separates
  rolls. Lowercase suffixes are fixtures on that landing: a glass candidate (g),
  label printer (p), a belt (>^v<), a perforator (*), a binding seam (=), or a
  chute (a coordinate displacement). The solver subsequently finds the true par.
*/
export const plans = [
  ['First Thud', 'EE', 'The scale takes a standing parcel. Roll right twice.'],
  ['Corner Label', 'ESSE', 'Go wide and line the long edge up with the scale.'],
  ['Side Door', 'NNEEESSE', 'Keep the long side tucked into the short roof.'],
  ['Short Shelf', 'ESENNW', 'Use the shelf to change which corner touches down.'],
  ['Offset Scale', 'SESENNE', 'Pass the elbow before you stand on the receipt.'],
  ['Long Way Round', 'SSEENWWSE', 'Return along the far side of the packing bench.'],
  ['Twin Benches', 'ENESWNNEE', 'Cut between the benches to get the label facing up.'],
  ['Dispatch Window', 'NNESSEENNW', 'The hatch sits on the inside of the horseshoe.'],
  ['Fragile Stamp', 'Eg E S S', 'A pane holds the wide side. Never stand upright on glass.'],
  ['Spent Pane', 'Ng N E N E E', 'A pane drops when your last edge leaves it.'],
  ['Footprint', 'E Sg S E N N', 'An overhanging corner still needs a floor tile.'],
  ['Dry Return', 'S S E Ng E N E', 'Return on the dry lip. Your first bridge is gone.'],
  ['No Standing', 'E N E W N Ng E E', 'Get the turn out of the way before the glass.'],
  ['Bridgekeeper', 'N N Eg S E S S', 'Leave a pane intact until the return crossing.'],
  ['East Wing', 'S E S E Ng E N N', 'Two alcoves. Give up the pane in the one you need.'],
  ['Museum Piece', 'E Sg E N N W Ng N E E', 'Use the two panes separately to reach the shipping gallery.'],
  ['Belt Lesson', 'E> E S S', 'A belt carries the crate with its shape unchanged.'],
  ['Missed Stop', 'N> N E E', 'Enter the belt from its north rail.'],
  ['Sideways Load', 'E v E N N', 'Follow the painted elbow while you lie sideways.'],
  ['Cut In', 'S S E> N E N N', 'Join the sorting belt in the middle.'],
  ['Drop Zone', 'N^ N E Eg E S S', 'Leave the carriage flat for the glazed drop zone.'],
  ['Back Belt', 'E E N> N W W S S', 'A belt can carry you back toward the loading aisle.'],
  ['Spare Bay', 'N E> N E S S', 'Park on the spare shelf before tipping again.'],
  ['Freight Waltz', 'E> E S> S E E', 'Two carries lead into different aisles.'],
  [
    'Perforation',
    'E E* N E X N = E S S',
    'Stand on the cutter. Move each half and bind them on the striped seam.',
  ],
  ['Two Counters', 'N N* W N E E X N = E E E', 'Select the other half to bring both labels to the seam.'],
  [
    'Side Seam',
    'S S* S E E E X S = S E N N E E',
    'The tape runs across this depot. Reassemble along the long stripe.',
  ],
  ['End Seam', 'E E* N N E E X N = N E S S E E', 'Align nose to tail on the short binding rail.'],
  ['Half Speed', 'N N* N> N E X N = N N E E S S', 'Only the marked half rides the small conveyor.'],
  ['Envelope Slot', 'S S* Wg S E E E S X S = S E E N N', 'A single light half can cross the envelope glass.'],
  ['Lost Corner', 'E E* N N E E E X N N = N N W W', 'The units can pass around opposite sides of the divider.'],
  ['Double Entry', 'N N* N E X N = E E E* S E X S = E E E', 'Two cutter desks use different binding strips.'],
  [
    'Wrong Address',
    'E@3,1 E S S W W N N W W',
    'The striped chute sends your whole footprint to the matching hatch.',
  ],
  ['Postmark', 'N@2,-2 N E E N E S S E E', 'Lie over the mouth. The far hatch keeps the orientation.'],
  [
    'Missent Half',
    'E E* N@2,-2 W X N N = N N',
    'Send a single half through the chute and follow the return label.',
  ],
  ['Return Receipt', 'N@2,-2 N E@3,0 E S S E E N N E E', 'Two paired hatches carry different postal stripes.'],
  ['Redirection', 'E@3,1 E S> S E E N E E S S', 'A chute feeds the belt aisle from the far side.'],
  ['Exchange Counter', 'N N* W@3,-2 S E X N = S S E E N E E', 'Use the hatch to get around the other parcel.'],
  ['Parcel Loop', 'E> E N@3,-2 N W< W S S W W N N', 'Break off the belt before re-entering the hatch.'],
  [
    'Special Delivery',
    'E E* N@2,-2 E X N@2,-2 = E E E N N W N N E E',
    'Dispatch each half, join them and stand the original parcel on its scale.',
  ],
  [
    'Night Inventory',
    'N N E> E S@3,1 S W W S S W N N E E',
    'Carry the last label across the overnight returns depot.',
  ],
  [
    'Unclaimed Freight',
    'S S* W@3,2 N W X S = N N E E N E S S E@4,3 E S S',
    'Collect the missing half, bind its label and ride the final dispatch chute.',
  ],
];
