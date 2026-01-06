export const LABS_LENS_CHOICES = [
  {
    id: "lens-tele",
    label: "Telephoto / Flattering",
    description: "85–135mm compression",
    prompt:
      "shot on an 85mm portrait lens with flattering facial compression, shallow depth of field, creamy bokeh background, and tight focus on the subject",
  },
  {
    id: "lens-standard",
    label: "Standard / Natural",
    description: "50mm human-eye look",
    prompt:
      "shot on a 50mm lens, natural human eye perspective with accurate facial proportions and medium depth of field",
  },
  {
    id: "lens-wide",
    label: "Wide / Environmental",
    description: "24mm story lens",
    prompt:
      "shot on a 24mm lens, wide angle perspective with slightly elongated features, expansive background view, and deep depth of field",
  },
];

export const LABS_RETOUCH_CHOICES = [
  {
    id: "finish-polished",
    label: "Polished professional",
    description: "Balanced realism",
    prompt:
      "Retouching: clean corporate makeup, neatly groomed hair, and smoothed skin while retaining texture for a professional headshot finish.",
  },
  {
    id: "finish-glamour",
    label: "High glamour",
    description: "Editorial gloss",
    prompt:
      "Retouching: flawless airbrushed skin finish with subtle grain, bold editorial makeup, and perfectly styled hair for a magazine-ready portrait.",
  },
  {
    id: "finish-raw",
    label: "Raw authenticity",
    description: "Documentary honesty",
    prompt:
      "Retouching: natural skin texture remains visible with minimal makeup, slight imperfections, and unstyled natural hair for documentary realism.",
  },
];

export const LABS_WARDROBE_CHOICES = [
  {
    id: "style-original",
    label: "Original wardrobe",
    description: "Steam + tailor what's worn",
    prompt:
      "the clothing already worn in the upload, preserved authentically while removing wrinkles and pinning fabric for the most flattering fit",
    useOriginal: true,
    theme: "neutral",
  },
  {
    id: "style-corporate",
    label: "Tailored formal",
    description: "Brioni / Kiton polish",
    prompt:
      "modern executive tailoring inspired by Brioni, Kiton, Armani, or Thom Browne—sleek suits, immaculate shirts, sharp ties, and luxurious fabrics that photograph like a GQ cover",
    useOriginal: false,
    theme: "mens",
  },
  {
    id: "style-casual",
    label: "City smart",
    description: "Todd Snyder / COS vibe",
    prompt:
      "elevated off-duty layers referencing Todd Snyder, Arket, COS, Fear of God, Peter Millar, or Bonobos—neutral palettes, premium knits, relaxed tailoring, and street-ready confidence",
    useOriginal: false,
    theme: "mens",
  },
  {
    id: "style-dramatic",
    label: "Art-forward",
    description: "NY menswear energy",
    prompt:
      "experimental menswear silhouettes inspired by New York Men’s Day runways or Lemon8 street fashion—statement outerwear, layered textures, unexpected proportions, and bold accessories",
    useOriginal: false,
    theme: "mens",
  },
  {
    id: "style-women-tailored",
    label: "Editorial womenswear",
    description: "Khaite / Proenza finesse",
    prompt:
      "powerful womenswear tailoring that feels like a Khaite, Proenza Schouler, or The Row look—sculpted blazers, fluid trousers, monochrome palettes, and architectural silhouettes that read like a Vogue feature",
    useOriginal: false,
    theme: "womens",
  },
  {
    id: "style-women-play",
    label: "Playful womenswear",
    description: "Jacquemus / Loewe joy",
    prompt:
      "fashion-forward womenswear inspired by Jacquemus, Loewe, Cult Gaia, and other modern labels—unexpected cutouts, asymmetric draping, color-pop accessories, and artful textures that photograph with lively energy",
    useOriginal: false,
    theme: "womens",
  },
  {
    id: "style-women-punk",
    label: "Edgy rebel",
    description: "High-gloss punk edge",
    prompt:
      "avant-garde punk couture referencing Alexander McQueen, Balenciaga, Rick Owens, and Ann Demeulemeester—glossy leathers, sculpted jackets, metal hardware, and daring asymmetry",
    useOriginal: false,
    theme: "womens",
  },
  {
    id: "style-women-vintage",
    label: "Vintage chic",
    description: "Deco glamour revival",
    prompt:
      "vintage-inspired luxury drawing from Chanel couture, Dior New Look, and Gucci archives—elegant midi silhouettes, nipped waists, silk scarves, brooches, and refined glove details",
    useOriginal: false,
    theme: "womens",
  },
  {
    id: "style-women-sport",
    label: "Sport luxe",
    description: "Runway athletic polish",
    prompt:
      "elevated performance wear inspired by Prada Linea Rossa, Moncler Grenoble, and Louis Vuitton sport capsules—sleek technical fabrics, structured windbreakers, bold stripes, and sculpted sneakers",
    useOriginal: false,
    theme: "womens",
  },
];

const lightingPrompt = (text) =>
  `${text.replace(/\s+/g, " ").trim()} Describe only the light’s effect on the subject and seamless backdrop. Keep every fixture, boom, stand, cable, reflection, or hardware element out of frame—lights must feel implied and invisible. Frame so the seamless background fills edge-to-edge with no studio floor, backdrop roll, or paper edge visible.`;

export const LABS_LIGHTING_GROUPS = [
  {
    id: "executive",
    title: "Executive & Authority",
    setups: [
      {
        id: "classic-executive",
        name: "Classic Executive",
        summary: "Modeled key with umbrella fill.",
        prompt: lightingPrompt(
          "[Lighting Setup: Classic Executive], main light is a medium softbox positioned camera right creating modeled light, fill light from an umbrella near camera axis to open shadows, subject against a seamless [USER_COLOR] studio backdrop, background lit naturally by spill from the main light."
        ),
      },
      {
        id: "pure-high-key",
        name: "Pure High Key",
        summary: "Bright, even corporate polish.",
        prompt: lightingPrompt(
          "[Lighting Setup: Pure High Key], main light is a medium softbox camera right, a gridded head bounces off the studio ceiling for general fill, two umbrellas blow out the seamless [USER_COLOR] backdrop to pure white, gobos prevent background flare on subject."
        ),
      },
      {
        id: "dramatic-rim-edge",
        name: "Dramatic Rim Edge",
        summary: "Hard rim plus warm gels.",
        prompt: lightingPrompt(
          "[Lighting Setup: Dramatic Rim Edge], main light is a medium softbox camera left, tight 30-degree gridded spot light with a warming gel acting as a hard rim/hair light from rear right, gobos used to shape light patterns on the seamless [USER_COLOR] backdrop."
        ),
      },
      {
        id: "hard-contrast",
        name: "Hard Contrast",
        summary: "Bold contrast with reflector fill.",
        prompt: lightingPrompt(
          "[Lighting Setup: Hard Contrast], main light is a tight 30-degree grid spot camera left creating hard shadows, a medium softbox is placed directly behind the grid to soften the core shadow slightly, white reflector fill camera right, seamless [USER_COLOR] backdrop."
        ),
      },
      {
        id: "hero-low-angle",
        name: "Hero Low Angle",
        summary: "Low-angle executive presence.",
        prompt: lightingPrompt(
          "[Lighting Setup: Hero Low Angle], low angle hero perspective with a medium softbox from camera right, gridded spot light acting as a tight hair light from rear left, separate medium softbox illuminating the seamless [USER_COLOR] backdrop to create separation."
        ),
      },
      {
        id: "overhead-authority",
        name: "Overhead Authority",
        summary: "Boomed softbox and silver fill.",
        prompt: lightingPrompt(
          "[Lighting Setup: Overhead Authority], main light is a large softbox on a boom stand positioned overhead and slightly left, silver reflector below camera right providing crisp fill, subject against a seamless [USER_COLOR] studio backdrop."
        ),
      },
      {
        id: "ambient-balance",
        name: "Ambient Balance",
        summary: "Feathered key with ambient glow.",
        prompt: lightingPrompt(
          "[Lighting Setup: Ambient Balance], main light is a medium softbox camera right feathering light onto the subject, subtle ambient studio practicals create a warm glow on the seamless [USER_COLOR] backdrop."
        ),
      },
      {
        id: "hard-architectural",
        name: "Hard Architectural",
        summary: "Graphic hard-light executive look.",
        prompt: lightingPrompt(
          "[Lighting Setup: Hard Architectural], main light is a hard 40-degree grid with spun glass diffusion from camera right creating distinct shadows, 20-degree gridded hair light, dedicated 30-degree gridded spot creating a pool of light on the seamless [USER_COLOR] backdrop."
        ),
      },
      {
        id: "controlled-spot",
        name: "Controlled Spot",
        summary: "Precision spotlit separation.",
        prompt: lightingPrompt(
          "[Lighting Setup: Controlled Spot], main light is a 40-degree grid with spun glass diffusion camera left, heavily goboed for precision, a separate 20-degree grid puts a tight spot on the seamless [USER_COLOR] backdrop."
        ),
      },
    ],
  },
  {
    id: "mood-drama",
    title: "Mood, Drama & Character",
    setups: [
      {
        id: "shadow-vignette",
        name: "Shadow Vignette",
        summary: "Moody falloff with reflector fill.",
        prompt: lightingPrompt(
          "[Lighting Setup: Shadow Vignette], main light is a medium softbox from camera right creating deep shadows, silver reflector on camera left adding crisp fill, separate background light with a tight 40-degree grid and diffusion casting a controlled pool of light onto the center of the seamless [USER_COLOR] backdrop, creating a vignette effect."
        ),
      },
      {
        id: "faux-window",
        name: "Faux Window",
        summary: "Window-pattern grids and gobos.",
        prompt: lightingPrompt(
          "[Lighting Setup: Faux Window], beauty dish with a grid positioned camera left and low, gobos used to shape the light into a window pattern on the subject and the seamless [USER_COLOR] backdrop."
        ),
      },
      {
        id: "backstage-grit",
        name: "Backstage Grit",
        summary: "Beauty dish contrast plus practicals.",
        prompt: lightingPrompt(
          "[Lighting Setup: Backstage Grit], single beauty dish main light camera left providing crisp contrasty light, practical bulb lights positioned in the background creating ambient glow on the seamless [USER_COLOR] backdrop."
        ),
      },
      {
        id: "studio-drama",
        name: "Studio Drama",
        summary: "Controlled spill for depth.",
        prompt: lightingPrompt(
          "[Lighting Setup: Studio Drama], main light is a medium softbox camera right creating dramatic shadows, controlled spill illuminates the seamless [USER_COLOR] backdrop."
        ),
      },
      {
        id: "dual-gel-drama",
        name: "Dual Gel Drama",
        summary: "Bi-color gel wash.",
        prompt: lightingPrompt(
          "[Lighting Setup: Dual Gel Drama], 30-degree grid main light camera left for high contrast, two separate background lights with gobos, one with a blue gel and one with a green gel, casting distinct color washes on the seamless [USER_COLOR] backdrop. Render only the gels’ color story—not the physical backlights—so the moody washes feel like pure atmosphere."
        ),
      },
      {
        id: "warm-whimsy",
        name: "Warm Whimsy",
        summary: "Warm overhead glow.",
        prompt: lightingPrompt(
          "[Lighting Setup: Warm Whimsy], treat the warm gelled heads as invisible ceiling bounces—you only describe the comforting golden wrap on the subject and subtle gradient on the seamless [USER_COLOR] backdrop. Never reveal the light bank on camera-left; if it starts to edge into frame, punch in or shift the angle until only the subject and backdrop remain."
        ),
      },
      {
        id: "tungsten-mix",
        name: "Tungsten Mix",
        summary: "CTO gels with patterned shadows.",
        prompt: lightingPrompt(
          "[Lighting Setup: Tungsten Mix], main light is a grid with spun glass diffusion and a CTO gel applied, a second 30-degree grid with black foil gobos creates a triangular shadow pattern on the seamless [USER_COLOR] backdrop."
        ),
      },
      {
        id: "theatrical-stage",
        name: "Theatrical Stage",
        summary: "Layered colored spotlights.",
        prompt: lightingPrompt(
          "[Lighting Setup: Theatrical Stage], large softbox main light camera left, background features four separate heads fitted with 30-degree grids and varied colored gels creating stage-like spotlights on the seamless [USER_COLOR] backdrop."
        ),
      },
      {
        id: "surreal-pop",
        name: "Surreal Pop",
        summary: "High-saturation pop look.",
        prompt: lightingPrompt(
          "[Lighting Setup: Surreal Pop], medium softbox main light camera right, processed with high-saturation color grading creating a surreal pop-art aesthetic against the seamless [USER_COLOR] backdrop."
        ),
      },
      {
        id: "artistic-gradient",
        name: "Artistic Gradient",
        summary: "Beauty dish plus gradient wash.",
        prompt: lightingPrompt(
          "[Lighting Setup: Artistic Gradient], main light is a beauty dish with a 30-degree grid camera right, gridded reflector for tight hair light, two umbrellas with colored gels illuminating the seamless [USER_COLOR] backdrop creating a graduated color effect."
        ),
      },
      {
        id: "motion-blur",
        name: "Motion Blur",
        summary: "Mix of strobes and tungsten blur.",
        prompt: lightingPrompt(
          "[Lighting Setup: Motion Blur], main light is a 30-degree grid camera left, a 20-degree grid acts as a hair light, continuous tungsten hot lights illuminate the seamless [USER_COLOR] backdrop allowing for motion blur drag during exposure."
        ),
      },
      {
        id: "color-blur",
        name: "Color Blur",
        summary: "Blue gel rim with warm blur.",
        prompt: lightingPrompt(
          "[Lighting Setup: Color Blur], large softbox main light camera left, 20-degree grid with blue gel hitting subjects from right rear, tungsten lights on seamless [USER_COLOR] backdrop creating warm motion blur effect."
        ),
      },
      {
        id: "gel-wash-split",
        name: "Gel Wash Split",
        summary: "Diffused dual-gel backdrop wash.",
        prompt: lightingPrompt(
          "[Lighting Setup: Gel Wash Split], main light is a medium softbox camera left, two background lights are fired through a diffusion screen, one with a red gel and one with a blue gel, creating a colored wash over the seamless [USER_COLOR] backdrop."
        ),
      },
      {
        id: "hard-shadow-play",
        name: "Hard Shadow Play",
        summary: "Crisp beauty dish shadows.",
        prompt: lightingPrompt(
          "[Lighting Setup: Hard Shadow Play], beauty dish main light creating sharp defined shadows, single gridded background light carving dramatic shapes on the seamless [USER_COLOR] backdrop."
        ),
      },
    ],
  },
  {
    id: "families-groups",
    title: "Families & Groups",
    setups: [
      {
        id: "group-overhead",
        name: "Group Overhead",
        summary: "Even boom coverage.",
        prompt: lightingPrompt(
          "[Lighting Setup: Group Overhead], large softbox placed high on a boom stand overhead/camera right to light the group evenly and avoid reflections, seamless [USER_COLOR] studio backdrop."
        ),
      },
      {
        id: "natural-fill",
        name: "Natural Fill",
        summary: "Softbox plus subtle on-camera fill.",
        prompt: lightingPrompt(
          "[Lighting Setup: Natural Fill], large softbox main light with on-camera flash diffuser used for subtle fill to open shadows on subjects, seamless [USER_COLOR] studio backdrop."
        ),
      },
      {
        id: "studio-window",
        name: "Studio Window",
        summary: "Window-mimicking softbox.",
        prompt: lightingPrompt(
          "[Lighting Setup: Studio Window], medium softbox main light camera left simulating window light, a 30-degree gridded spot light creates accent on the seamless [USER_COLOR] backdrop."
        ),
      },
      {
        id: "soft-bonding",
        name: "Soft Bonding",
        summary: "Wrapping octabank with rim.",
        prompt: lightingPrompt(
          "[Lighting Setup: Soft Bonding], medium octagon softbox main light camera left providing soft wrapping light, a 40-degree grid with spun glass diffusion acts as a subtle rim light from rear right against seamless [USER_COLOR] backdrop."
        ),
      },
      {
        id: "active-coverage",
        name: "Active Coverage",
        summary: "Octabank coverage for movement.",
        prompt: lightingPrompt(
          "[Lighting Setup: Active Coverage], large octagon softbox main light camera right for broad coverage allowing movement, large reflector fill camera left, seamless [USER_COLOR] studio backdrop."
        ),
      },
      {
        id: "balanced-softbox",
        name: "Balanced Softbox",
        summary: "Rectangular key with umbrella fill.",
        prompt: lightingPrompt(
          "[Lighting Setup: Balanced Softbox], medium rectangular softbox camera right providing main illumination, additional fill from umbrella camera left, seamless [USER_COLOR] studio backdrop."
        ),
      },
      {
        id: "warm-interior",
        name: "Warm Interior",
        summary: "Second light adds separation.",
        prompt: lightingPrompt(
          "[Lighting Setup: Warm Interior], medium softbox main light camera right, a second light with a 30-degree grid is angled down from above to separate subjects from the seamless [USER_COLOR] backdrop."
        ),
      },
      {
        id: "bounce-fill",
        name: "Bounce Fill",
        summary: "Ceiling bounce for gentle fill.",
        prompt: lightingPrompt(
          "[Lighting Setup: Bounce Fill], medium softbox main light camera right with a gentle ceiling bounce providing fill over the seamless [USER_COLOR] backdrop. The ceiling glow should feel natural and sourceless—never depict the reflector or bounce card itself."
        ),
      },
      {
        id: "even-balance",
        name: "Even Balance",
        summary: "Even key across subjects.",
        prompt: lightingPrompt(
          "[Lighting Setup: Even Balance], medium softbox main light camera right creating even illumination across multiple subjects against seamless [USER_COLOR] backdrop."
        ),
      },
      {
        id: "umbrella-fill",
        name: "Umbrella Fill",
        summary: "Portable umbrella coverage.",
        prompt: lightingPrompt(
          "[Lighting Setup: Umbrella Fill], portable strobe bounced into an off-camera white umbrella to illuminate subjects evenly against the seamless [USER_COLOR] backdrop. Treat the umbrella as invisible; only the wraparound quality of the light is shown."
        ),
      },
      {
        id: "twilight-balance",
        name: "Twilight Balance",
        summary: "Cool gradient background.",
        prompt: lightingPrompt(
          "[Lighting Setup: Twilight Balance], medium softbox main light camera right, background lights with blue gel creating cool tone gradient on seamless [USER_COLOR] backdrop."
        ),
      },
      {
        id: "large-space-fill",
        name: "Large Space Fill",
        summary: "Multiple heads for big rooms.",
        prompt: lightingPrompt(
          "[Lighting Setup: Large Space Fill], medium softbox left, large softbox right for main subjects, two additional heads are bounced off the studio ceiling to create ambient fill over seamless [USER_COLOR] backdrop."
        ),
      },
      {
        id: "studio-spotlight",
        name: "Studio Spotlight",
        summary: "Group light plus hero accent.",
        prompt: lightingPrompt(
          "[Lighting Setup: Studio Spotlight], emulate the feel of a large plume soft wrap coming from camera right and a tight 30-degree rim accent on the hero subject, yet keep every fixture off-frame and unseen. Treat both sources as implied, invisible lights sculpting the subject—never show the physical softbox, boom, or spotlight head. Allow only their effect on the seamless [USER_COLOR] backdrop and the subject’s edges to be visible."
        ),
      },
    ],
  },
  {
    id: "studio-clean",
    title: "Studio Clean & Commercial",
    setups: [
      {
        id: "butterfly-beauty",
        name: "Butterfly Beauty",
        summary: "Classic clamshell beauty setup.",
        prompt: lightingPrompt(
          "[Lighting Setup: Butterfly Beauty], imagine a large overhead softbox and white reflector shaping the face, plus a gridded hair light for separation on the seamless [USER_COLOR] backdrop. Describe only the luminous beauty ripple—never the reflector, boom, or any hardware. If a reflector would be visible, reframe tighter so only the subject and backdrop remain."
        ),
      },
      {
        id: "edgy-rim",
        name: "Edgy Rim",
        summary: "Strip-lit rim emphasis.",
        prompt: lightingPrompt(
          "[Lighting Setup: Edgy Rim], main light is a large gridded softbox camera left, strong rim lighting provided by two medium softboxes placed rear left and rear right of subject creating bright highlights on clothing edges, distinct hair light from an overhead gridded boom spot, seamless [USER_COLOR] studio backdrop."
        ),
      },
      {
        id: "enveloping-soft",
        name: "Enveloping Soft",
        summary: "Fill-bounced ceiling and walls.",
        prompt: lightingPrompt(
          "[Lighting Setup: Enveloping Soft], medium softbox main light camera right, two fill lights bounced off studio ceiling and walls to create an enveloping soft light against seamless [USER_COLOR] backdrop."
        ),
      },
      {
        id: "formal-promo",
        name: "Formal Promo",
        summary: "Tight main light control.",
        prompt: lightingPrompt(
          "[Lighting Setup: Formal Promo], medium softbox main light camera right with an extra grid placed in front of it for tighter control, large white reflector fill, 40-degree gridded boom hair light, spun glass diffused grid on seamless [USER_COLOR] backdrop."
        ),
      },
      {
        id: "high-angle-down",
        name: "High Angle Down",
        summary: "Ladder POV with overhead octa.",
        prompt: lightingPrompt(
          "[Lighting Setup: High Angle Down], camera elevated on ladder looking down, octagon softbox on boom stand angled down toward subject, reflector on floor for fill, seamless [USER_COLOR] studio backdrop."
        ),
      },
      {
        id: "graphic-studio",
        name: "Graphic Studio",
        summary: "High camera angle with pops of color.",
        prompt: lightingPrompt(
          "[Lighting Setup: Graphic Studio], high camera angle, medium softbox main light, medium softbox lighting backdrop, 30-degree gridded hair light, 30-degree grid with red gel creating accent on seamless [USER_COLOR] backdrop."
        ),
      },
      {
        id: "mixed-commercial",
        name: "Mixed Commercial",
        summary: "Light bank plus ceiling bounce.",
        prompt: lightingPrompt(
          "[Lighting Setup: Mixed Commercial], medium light bank main camera left, a 30-degree grid bounces off ceiling for fill, separate accent light on seamless [USER_COLOR] backdrop creating depth."
        ),
      },
      {
        id: "clamshell-beauty",
        name: "Clamshell Beauty",
        summary: "Overhead softbox with reflector below.",
        prompt: lightingPrompt(
          "[Lighting Setup: Clamshell Beauty], large softbox overhead as main light, large reflector below face creating wrap-around beauty lighting, hair light separating from seamless [USER_COLOR] backdrop."
        ),
      },
      {
        id: "clean-corporate",
        name: "Clean Corporate",
        summary: "Softbox with reflector fill.",
        prompt: lightingPrompt(
          "[Lighting Setup: Clean Corporate], medium softbox camera right creating flattering modeling, white reflector fill, even illumination on seamless [USER_COLOR] backdrop."
        ),
      },
      {
        id: "fashion-forward",
        name: "Fashion Forward",
        summary: "Octabank key with strip edge lights.",
        prompt: lightingPrompt(
          "[Lighting Setup: Fashion Forward], large octabank main light, strip lights as edge lights creating definition, seamless [USER_COLOR] backdrop with subtle gradient from background lights."
        ),
      },
    ],
  },
];
