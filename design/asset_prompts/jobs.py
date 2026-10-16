# -*- coding: utf-8 -*-
"""Job definitions for 《宣和》 asset generation. id -> dict(kind, aspect, subject, ref?, group)."""
NOTEXT = " Absolutely no text, no characters, no letters, no numbers, no seals, no inscriptions anywhere in the image."
WHITE = " Isolated on a plain flat pure white background (#FFFFFF) with generous empty margin around, soft contact shadow only."

LAND = "Landscape 3:2 aspect ratio (1536x1024)."
PORT = "Portrait 2:3 aspect ratio (1024x1536)."

JOBS = {}


def add(id, group, aspect, subject, ref=None, outkind=None):
    JOBS[id] = dict(id=id, group=group, aspect=aspect, subject=subject + NOTEXT, ref=ref,
                    kind=outkind or id.split(".")[0])


# ------------------------------------------------------------------ MAP + UI
add("map.base", "map", LAND,
    "SUBJECT: A full-bleed flat top-down hand-painted silk map of northern and central China around 1120 AD in blue-green landscape style, strictly top-down like a survey map, no perspective, no desk, no frame, painted edge to edge on pale aged silk. "
    "Layout (important, keep these positions): the Yellow River enters at the left edge in the middle height, makes its great rectangular northern loop around the Ordos in the upper-left quarter, comes back down, then flows east straight through the exact centre of the image and reaches the sea at the right edge a little above the middle, just north of a peninsula; "
    "the Shandong peninsula juts out into the sea on the right side slightly below the middle; the Bohai gulf is a bay at the upper right with the Liaodong peninsula above it; "
    "the Huai River and then the wide Yangtze River flow from left to right across the lower third, the Yangtze reaching the sea at the lower right; the Grand Canal is a thin straight waterway from the Yellow River in the centre down to the Yangtze delta; "
    "the Taihang mountains run north-south just above and left of the centre, the Yan mountains run east-west across the top centre, the Qinling mountains lie left of centre below the Yellow River, the Sichuan basin is a green hollow in the lower-left corner surrounded by mountains, the Fujian coastal hills are in the lower-right corner; "
    "dry northern steppe grassland across the top-left and top-centre, dark Manchurian forests at the top-right corner, the Ordos desert and the Helan mountains at the upper-left edge, the Korean peninsula only as a faint hilly edge at the far right top behind the gulf. "
    "The sea is a plain calm celadon expanse along the right edge and bottom-right with simple wave scroll lines: NO islands, NO Taiwan, NO Japan. "
    "Mountains in layered azurite blue and malachite green over ochre, plains in pale silk-ochre and light green fields, rivers in pale blue with fine ink outlines. About twelve tiny walled-city icons (blank), faint dotted road lines, mist bands. "
    "NO text, NO labels, NO legend, NO compass, NO cartouche, NO borders with writing.")

add("title.scroll", "ui", LAND,
    "SUBJECT: Title screen painting. A twilight panorama of the Northern Song capital Bianjing (Kaifeng) in the manner of a blue-green landscape handscroll: in the foreground right, the vermilion balustrade of a high palace terrace with grey-tiled eaves; a lone slender emperor in a pale ochre-yellow robe and a black futou hat with long straight horizontal wings, seen from behind, gazes north; below, the crowded city of wards, the rainbow bridge over the Bian canal with boats, lantern lights, and the green imperial garden mountain Genyue with strange tall rocks; beyond the city the Yellow River and far blue-green ranges; on the far northern horizon a faint cold grey haze and a few tiny dark specks of horsemen against a pale winter sky, an ominous chill. "
    "The entire left third of the image is calm open sky and soft mist (empty space for a title to be added later). Elegant, melancholic, autumn-into-winter light.")

add("ui.desk", "ui", LAND,
    "SUBJECT: UI background texture: top-down view of a Northern Song imperial writing desk surface. Fine pale celadon-grey lacquered wood with a subtle grain across the centre, framed all around by a wide border of woven silk brocade with a restrained pattern of peony scrolls and cloud motifs in muted azure, malachite and pale ochre on a deep indigo-ink ground. The centre area is calm, empty and evenly lit for panels to be placed over it. Perhaps a tiny hint of a celadon water-dropper in one corner and a bamboo brush rest in another, nothing else. Flat top-down, no perspective.")

add("ui.paper", "ui", LAND,
    "SUBJECT: UI texture: a single sheet of pale aged Chengxintang-style xuan paper with visible fibres and a faint warm ivory tone, filling the image almost to the edge, slightly irregular soft deckled edges, faint mottled foxing, soft vignette; the surface is completely blank, evenly lit, flat top-down. Plain very dark ink-grey background visible only in the thin corner gaps.")

add("ui.silk", "ui", LAND,
    "SUBJECT: UI texture: tileable seamless pale silk damask fill, flat top-down, filling the entire frame edge to edge. Pale celadon-white silk ground with a subtle low-contrast woven pattern of small cloud scrolls and tiny peony roundels in a slightly darker celadon tone; no focal object, no border, no vignette.")

add("ui.edict_paper", "ui", LAND,
    "SUBJECT: A horizontally unrolled Northern Song imperial edict handscroll, centred, filling nearly the whole frame: pale yellow silk-paper surface with a very faint cloud-and-crane damask pattern, a mounting border of light azure brocade top and bottom, round jade-capped wooden rollers at left and right ends, completely blank empty writing surface, soft shadow on a dark celadon desk backdrop. Flat frontal view.")

add("ui.lacquer_bar", "ui", LAND,
    "SUBJECT: UI element: a very wide horizontal dark ink-black lacquer bar with a thin silver-grey inlay border and small celadon jade corner fittings at both ends with a fine cloud scroll, five empty round recessed medallion sockets evenly spaced along it with thin silver rims, and long empty dark space beside each socket. The bar spans the full width of the image, centred vertically, height about one quarter of the image, perfectly straight, flat frontal view, with a plain flat pure white background above and below it.")

add("ui.ink_button", "ui", LAND,
    "SUBJECT: UI element: a single rectangular Chinese ink stick used as a button, deep black ink with a faint sheen, slightly rounded edges, thin silver line border, completely plain empty flat face with only a faint embossed cloud scroll at both ends and a blank centre, shown straight on, flat frontal view, filling about 60% of the image width." + WHITE)

add("ui.seal", "ui", LAND,
    "SUBJECT: UI element: a single square vermilion seal-paste stamp impression, slightly irregular edges with dry-brush texture, completely blank empty centre (no glyph, no carving), thin slightly darker rim, flat frontal view, filling about 55% of the image height, centred." + WHITE)

add("ui.crisis_beacon", "ui", LAND,
    "SUBJECT: UI element: a Northern Song frontier beacon tower (a rammed-earth signal platform with a brazier on top) on a small rocky mound, with a tall plume rising from the brazier; the plume is painted as four stacked bands from bottom to top: pale celadon mist, pale ochre smoke, grey smoke, and dark ink-black smoke with a vermilion glow at the top, like a four-stage threat gauge. Clean game-icon rendering, centred." + WHITE)

RIB = ("SUBJECT: UI element: a single vertical hanging silk banner ribbon filling the whole image, straight frontal view, {desc}. "
       "A thin silver-grey woven border down both long edges, a round empty celadon-jade medallion disc in the upper third (blank, no glyph), "
       "a restrained woven pattern below it, and a swallow-tail (V-notched) bottom hem with a short silk tassel at the tip; the top has a slim dark "
       "lacquered wooden hanging bar with celadon jade end caps. Northern Song taste: elegant, muted, not gaudy, no gold leaf. The silk fills the frame "
       "edge to edge on a plain flat pure white background in the narrow gaps only.")
add("ui.ribbon_cai", "ribbons", PORT, RIB.format(desc="deep muted purple silk with a pale silver cloud-scroll pattern (the old chief minister's clique)"), outkind="ui")
add("ui.ribbon_xingchen", "ribbons", PORT, RIB.format(desc="muted crimson-vermilion silk with a pale ochre peony pattern (the imperial favourites)"), outkind="ui")
add("ui.ribbon_neishi", "ribbons", PORT, RIB.format(desc="dark ink-grey silk with a faint silver palace-lattice pattern (the palace eunuchs)"), outkind="ui")
add("ui.ribbon_qingyi", "ribbons", PORT, RIB.format(desc="celadon green silk with a pale jade bamboo-leaf pattern (the upright remonstrating officials)"), outkind="ui")

SEASON = {
    "spring": "early spring: a sprig of plum blossom and a few fallen petals lie at one corner, cool pale morning light",
    "summer": "summer: a few lotus leaves in a celadon dish at one corner, bright warm light with a hint of green",
    "autumn": "autumn: a few red maple and yellow ginkgo leaves at one corner, warm low golden light",
    "winter": "winter: a little snow-dusted pine twig and a cold hand-warmer at one corner, pale blue-grey light",
}
for key, mood in SEASON.items():
    add(f"ui.season.{key}", "season", LAND,
        "SUBJECT: UI background: top-down view of the same Northern Song imperial desk (pale celadon-grey lacquer, brocade border of peony scrolls and clouds in azure and malachite on indigo), the centre calm and empty for panels; " + mood + ". Flat top-down, no perspective.",
        outkind="ui")

add("icon.sheet", "icons", LAND,
    "SUBJECT: A sprite sheet of TWELVE separate round medallion game icons arranged in two rows of six, evenly spaced with wide gaps on a plain flat pure white background; each icon is a circular celadon-glazed porcelain disc with a thin silver rim containing a simple bold emblem in ink and muted colours in Northern Song style, in this exact order. "
    "Row 1, left to right: (1) strings of square-holed copper cash coins (treasury); (2) a woven grain basket with ears of wheat (grain); (3) a square jade seal block with a tassel, blank face (imperial authority); (4) two farmers in straw hats under a willow (people's morale); (5) a tangled ink-stained scroll with a broken brush (corruption); (6) a long-winged black futou hat with a peony flower tucked into it (favourites' sway). "
    "Row 2, left to right: (7) a strange tall perforated Taihu garden rock on a barge (Huashi tribute burden); (8) a bow, a quiver and a rounded helmet (military readiness); (9) a Khitan felt yurt under a setting sun (Liao's remaining strength); (10) a Jurchen fur hat and a whip (Jurchen contempt); (11) a galloping horse silhouette over a frozen river (Jurchen invasion momentum); (12) a blank ivory court tablet (spare). "
    "Every emblem is blank of any writing.",
    outkind="icon")

# ------------------------------------------------------------------ PORTRAITS
PW = (" Half-length vertical portrait of a single person, centred, from head to mid-thigh, facing three-quarter view, painted on pale silk in Northern Song academy gongbi style with fine ink outlines and delicate colours, background a softly misted blue-green landscape or interior fading to the edges. Face clearly visible, expressive, individualised. ")
HAT = "a black lacquered futou hat with long straight horizontal wings extending far to both sides"

P = {}
P["zhao_ji"] = ("Emperor Huizong of Song (Zhao Ji), age 38, slender and refined, long elegant face, thin moustache and a small neat beard, dreamy artistic eyes, wearing a pale ochre-yellow round-collar robe with " + HAT + ", a jade belt, holding a slender brush in one hand. Background: misted imperial garden with strange Taihu rocks, cranes and green pines. No dragon embroidery.")
P["zhao_huan"] = ("Zhao Huan, crown prince of Song, age 20, earnest cautious young face, slight wispy moustache, anxious restrained expression, crimson-purple round-collar robe with " + HAT + ", hands folded in sleeves. Background: dim lamp-lit Eastern Palace study with bookshelves.")
P["zhao_kai"] = ("Zhao Kai, Prince of Yun, age 19, handsome confident young scholar-prince, bright clever eyes, faint smile, purple round-collar robe with " + HAT + ", holding a folded fan. Background: misted palace garden pavilion with blossoms.")
P["cai_jing"] = ("Cai Jing, Grand Preceptor and senior chief minister, age 73, old but shrewd, long white beard, sharp knowing eyes, composed self-assured smile, purple round-collar robe with a gold fish-pouch and " + HAT + ", holding an ivory court tablet. Background: misted Secretariat hall with lattice screens.")
P["cai_you"] = ("Cai You, son of Cai Jing, court favourite, age 43, well-fed face, playful sly smile, short beard, purple round-collar robe with " + HAT + ", a jade pendant. Background: palace banquet pavilion with musicians in soft focus.")
P["yu_shen"] = ("Yu Shen, Grand Councillor, age about 70, mild cautious old official, grey beard, tired eyes, purple round-collar robe with " + HAT + ", holding an ivory court tablet. Background: soft-focus Chancellery corridor.")
P["wang_fu"] = ("Wang Fu, junior chief minister, age 41, strikingly handsome and polished, smooth face, unusually bright golden-brown eyes, eloquent confident smile, purple round-collar robe with " + HAT + ". Background: luxurious mansion hall with lacquered screens and a garden rock.")
P["tong_guan"] = ("Tong Guan, palace eunuch who commands the Bureau of Military Affairs, age 66, tall and robust with a powerful frame unusual for a eunuch, a few sparse whiskers on the chin, bold proud expression, purple round-collar robe with " + HAT + ", one hand on a sword hilt. Background: military headquarters tent with plain banners and a map table.")
P["liang_shicheng"] = ("Liang Shicheng, palace eunuch who handles the emperor's handwritten decrees, age about 55, beardless smooth pale face, soft cunning smile, scholarly pretensions, crimson round-collar robe with " + HAT + ", holding a rolled yellow silk decree (blank). Background: quiet inner-palace document chamber with brush stands.")
P["zhu_mian"] = ("Zhu Mian, head of the Suzhou tribute bureau for rare rocks and plants, age 45, plump, fleshy obsequious face, small moustache, rich crimson robe with " + HAT + ", one hand gesturing toward a strange perforated Taihu rock. Background: canal quay at Suzhou with a huge rock on a barge.")
P["gao_qiu"] = ("Gao Qiu, Grand Marshal of the palace guards, age about 55, sleek and worldly, trimmed beard, easy smile, purple round-collar robe with " + HAT + ", a leather kemari kickball tucked under one arm. Background: palace drill ground with guards standing idle.")
P["li_bangyan"] = ("Li Bangyan, Hanlin academician and witty court jester-minister, age about 40, handsome dashing face, playful grin, crimson round-collar robe with " + HAT + ", holding a folding fan. Background: palace banquet hall with lanterns.")
P["li_gang"] = ("Li Gang, upright outspoken official, age 37, square resolute face, short black beard, intense righteous gaze, plain green round-collar robe with " + HAT + ", holding an ivory court tablet upright. Background: misty Fujian mountain county with a small tax office.")
P["zong_ze"] = ("Zong Ze, veteran official, age 60, weathered stern face, grey beard, fierce unbending eyes, plain dark-green robe with a soft black cap, standing firm. Background: grey northern coast and a city wall at Dengzhou.")
P["zhang_shuye"] = ("Zhang Shuye, prefect of Haizhou, age 55, calm capable face, neat grey beard, crimson round-collar robe with " + HAT + ". Background: coastal prefecture walls with boats on a grey sea.")
P["chen_dong"] = ("Chen Dong, Imperial University student, age 34, lean ardent face, short beard, burning eyes, plain white scholar's robe with a soft black cap, holding a long memorial scroll (blank). Background: the Imperial University courtyard with students.")
P["zhong_shidao"] = ("Zhong Shidao, veteran general of the Northwestern armies, age 69, white beard and white eyebrows, calm deep eyes, upright dignified posture, crimson round-collar robe with " + HAT + ", hand resting on a sword. Background: loess plateau frontier fortress with beacon towers.")
P["zhong_shizhong"] = ("Zhong Shizhong, general of the Northwestern armies, younger brother of Zhong Shidao, age 61, grey beard, loyal stern face, dark red military robe with leather belt and a soft black cap. Background: frontier camp on the loess hills.")
P["yao_pingzhong"] = ("Yao Pingzhong, young general of the Northwestern armies, age 21, bold fiery handsome face, eager eyes, crimson military robe with leather belt and a soft black cap, holding a spear. Background: windy frontier plateau with horses.")
P["zhang_xiaochun"] = ("Zhang Xiaochun, prefect of Taiyuan, age about 50, practical serious face, neat beard, crimson round-collar robe with " + HAT + ", holding a rolled map. Background: the massive walls of Taiyuan with mountains behind.")
P["ma_kuo"] = ("Ma Kuo, young military envoy who has seen the Jurchens, age about 30, frank honest face, short beard, keen eyes, green military round-collar robe with a leather belt and a soft black cap, a bow case at the hip. Background: windswept northern plain with a distant Jurchen camp.")
P["zhao_liangsi"] = ("Zhao Liangsi (Ma Zhi), a defector from the Liao-held Yan region now serving Song as envoy, age about 50, northern face with a full beard, ambitious persuasive expression, crimson round-collar robe with " + HAT + ", holding a rolled treaty scroll (blank). Background: a sea-going junk at a misty harbour.")
P["guo_yaoshi"] = ("Guo Yaoshi, leader of the Ever-Victorious Army, a Bohai-born mercenary general, age about 45, rugged scarred face, thick beard, wary calculating eyes, northern-style narrow-sleeved armoured robe with fur collar, a felt cap. Background: Yanjing city walls under a cold sky with cavalry.")
P["fang_la"] = ("Fang La, leader of a peasant uprising in Zhejiang, age about 45, sturdy rural lacquer-grove owner, sun-browned face, short beard, fierce determined eyes, plain hemp clothing with a red head cloth, holding a farm blade. Background: misty Zhejiang hills and lacquer trees.")
P["wanyan_aguda"] = ("Wanyan Aguda, founding emperor of the Jurchen Jin, age 52, powerful broad-shouldered man, shaved crown with long braided queues behind the ears, full dark beard, commanding fierce gaze, fur-trimmed narrow-sleeved left-lapel robe, a fur hat, a bow. Background: snowy Manchurian forest and a camp of felt tents.")
P["wanyan_wuqimai"] = ("Wanyan Wuqimai, Jurchen prince, younger brother of Aguda, age 45, stocky solemn face, shaved crown with braided queues, beard, fur-trimmed robe. Background: Jurchen wooden palace hall with hunting trophies.")
P["wanyan_zonghan"] = ("Wanyan Zonghan (Nianhan), Jurchen general, age 40, hard ruthless face, shaved crown with braided queues, short beard, cold eyes, lamellar armour over a fur robe. Background: windswept Datong plains with Jurchen cavalry.")
P["wanyan_zongwang"] = ("Wanyan Zongwang (Wolibu), Jurchen prince-general, age about 30, energetic bold face, shaved crown with braided queues, sparse beard, eager eyes, lamellar armour with fur collar. Background: frozen river and Jurchen horsemen.")
P["yelu_yanxi"] = ("Yelu Yanxi, the Tianzuo Emperor of Liao, age 45, indolent heavy-lidded face, Khitan shaved head with temple locks, round-collar narrow-sleeved hunting robe in deep blue with gold roundels, a falcon on his wrist. Background: autumn steppe with felt tents and hunting dogs.")
P["yelu_dashi"] = ("Yelu Dashi, Khitan scholar-general, age 33, intelligent resolute face, Khitan shaved head with temple locks, short beard, round-collar narrow-sleeved robe with light armour, holding a scroll and a sword. Background: walls of Yanjing under autumn clouds.")
P["zhang_jue"] = ("Zhang Jue, Han Chinese commander of Pingzhou in Liao service, age about 45, anxious ambitious face, beard, crimson northern-style robe with a soft cap. Background: coastal fortress town of Pingzhou with the sea beyond.")

for cid, desc in P.items():
    add(f"portrait.{cid}.default", "portraits", PORT, "SUBJECT:" + PW + desc, outkind="portrait")

ALT = {
    "zhao_ji.daoist": "Same person as the reference image (Emperor Huizong, slender, thin moustache, small beard), now dressed as a Daoist sovereign: a flowing pale blue-and-white Daoist robe with cloud patterns and a small lotus-shaped Daoist crown, holding a whisk, serene detached expression. Background: Daoist altar with incense smoke and cranes.",
    "zhong_shidao.armor": "Same person as the reference image (Zhong Shidao, white beard, calm deep eyes), now in full Song lamellar armour with a dark red cloak and a rounded iron helmet, grave determined expression. Background: city walls under snow with the Northwestern army arriving.",
    "yao_pingzhong.armor": "Same person as the reference image (Yao Pingzhong, young bold face), now in full Song lamellar armour with a crimson cloak, helmet with a red tassel, holding a spear, night raid atmosphere with torches.",
    "tong_guan.armor": "Same person as the reference image (Tong Guan, tall robust eunuch with a few sparse whiskers), now in ornate gilt lamellar armour over a purple robe, commanding pose before an army. Background: northern plain with Song banners (plain, no text).",
    "li_gang.armor": "Same person as the reference image (Li Gang, square resolute face, short black beard), now wearing a simple lamellar cuirass over his official robe, commanding the defence on a snowy city wall at Bianjing, soldiers with crossbows behind.",
    "guo_yaoshi.armor": "Same person as the reference image (Guo Yaoshi, rugged scarred face, thick beard), now in full northern lamellar armour with fur cloak and iron helmet, on horseback pose, wary eyes. Background: Ever-Victorious Army cavalry at a river ford.",
    "wanyan_zonghan.armor": "Same person as the reference image (Zonghan, hard ruthless face, shaved crown with braids), now in heavy Jurchen iron lamellar armour with a fur-trimmed helmet, before the siege of a great walled city.",
    "wanyan_zongwang.armor": "Same person as the reference image (Zongwang, energetic bold face, braids), now in heavy Jurchen iron armour on a riverbank in winter, crossing the frozen Yellow River with cavalry behind.",
}
for key, desc in ALT.items():
    cid, variant = key.split(".")
    add(f"portrait.{cid}.{variant}", "alt", PORT, "SUBJECT: Keep the face, age and identity of the attached reference portrait exactly." + PW + desc,
        ref=f"portrait.{cid}.default", outkind="portrait")

# ------------------------------------------------------------------ EVENTS (1344x896 after processing)
EV = {
    "haishang": "A Song sea-going junk with plain sails crossing a grey-green sea toward a cold northern coast where Jurchen horsemen with braided queues wait on the shore beside a felt tent; envoys in Song robes on deck; dramatic clouds.",
    "huashi": "A huge strange perforated Taihu garden rock lashed onto a great barge on the Grand Canal, hauled by long lines of exhausted labourers on the towpath, a broken bridge and a demolished house wall behind; officials in crimson robes supervising from a pavilion.",
    "genyue": "The imperial artificial mountain garden Genyue in Bianjing: towering strange rocks, pavilions, cranes, rare trees and waterfalls, a few courtiers strolling, lavish and dreamlike blue-green landscape.",
    "cai_retire": "An aged chief minister in a purple robe bowing as he leaves a palace hall through a vermilion gate, younger officials watching, autumn leaves falling, mood of transition.",
    "shangjing_falls": "Jurchen cavalry with braided queues storming the gates of a northern steppe walled capital, smoke rising over Khitan felt-roofed halls, banners plain, restrained no gore.",
    "fangla_rising": "A peasant uprising in the misty Zhejiang hills: crowds of villagers with red head cloths, farm blades and torches pouring out of a lacquer-tree valley, a burning tribute-bureau warehouse in the distance.",
    "nanzheng": "The Northwestern Song army marching south in long columns along a river road under willows, cavalry and infantry with plain banners, boats on the canal, heading into green southern hills.",
    "songjiang": "Outlaws of the Liangshan marshes surrendering on a misty lakeshore: rough men in boats lay down their weapons before a Song prefect in a crimson robe, burning boats behind them.",
    "zhongjing_falls": "Liao's Central Capital in winter falling to Jurchen horsemen, a Khitan emperor's hunting party fleeing west across snowy steppe in the foreground.",
    "beifa": "A Song army camp on the Baigou river at the northern frontier at dawn: lines of tents, plain banners, generals in a tent studying a map, cavalry fording the shallow river.",
    "baigou_defeat": "A Song army in disorder retreating across a muddy river under rain, Khitan cavalry with temple locks pursuing on the far bank, abandoned carts, restrained no gore.",
    "guo_surrender": "The Ever-Victorious Army leader and his cavalry dismounting before a Song commander's tent, offering a blank tally token, plain banners, northern plain at autumn.",
    "yanjing_taken": "Jurchen cavalry entering the great walled city of Yanjing in the snow through an open gate, Khitan officials kneeling at the roadside.",
    "yanjing_returned": "An emptied city of Yanjing handed over: Song officials and a small army enter through a gate into deserted streets, abandoned houses, a few old people, long lines of deported families leaving in the distance under Jurchen escort.",
    "zhangjue": "A coastal northern fortress town at Pingzhou, a Han commander in a crimson robe raising a plain Song-red flag on the gate tower while soldiers watch uncertainly.",
    "aguda_death": "A Jurchen funeral in a snowy forest: mourners with braided queues and fur cloaks kneeling around a wooden bier draped with furs, horses standing, smoke from a fire, solemn.",
    "zhangjue_executed": "A grim night scene in a Song frontier office: a closed lacquered wooden box on a table between a Song official and a Jurchen envoy in fur, guards watching, a single lamp, restrained, nothing gory shown.",
    "famine": "Famine on the North China plain: dry cracked fields, gaunt villagers with bundles walking along a road, a small charity porridge kitchen by a temple, grey sky.",
    "mianfu": "Tax collectors in a county town square registering villagers and taking strings of cash coins at a table, anxious crowd, a notice board (blank), late autumn.",
    "tianzuo_captured": "The last Liao emperor, a Khitan man in a blue hunting robe, captured by Jurchen horsemen in a snowy mountain valley, his small escort scattered.",
    "jin_envoy": "An arrogant Jurchen envoy in fur and braids standing unbowed in a Song palace audience hall with vermilion pillars, Song officials in long-winged hats murmuring uneasily.",
    "chen_dong": "Students of the Imperial University in white robes kneeling in the snow before the palace gate Xuande Gate, holding up blank memorial scrolls, crowds of townspeople behind them.",
    "jin_invasion": "Jurchen cavalry in iron armour with braided queues crossing the frozen Yellow River in winter in long columns, banners plain, a Song riverside town burning faintly on the far bank, cold blue-grey dawn.",
    "taiyuan_siege": "The massive walls of Taiyuan under siege in snow, Jurchen siege towers and catapults below, Song defenders with crossbows on the battlements, smoke and arrows, restrained.",
    "bianjing_siege": "The great outer walls of Bianjing in winter, defenders on the ramparts with crossbows and siege engines, a vast Jurchen camp spread across the snowy plain outside, the Bian canal frozen.",
    "ligang_defense": "A resolute Song official in a cuirass over his robe directing soldiers and townspeople carrying stones and arrows up a city wall staircase in the snow, torches, determined faces.",
    "qinwang": "The Northwestern army arriving to relieve the capital, long columns of veteran cavalry with red cloaks under a white-bearded general on horseback, approaching a city across a snowy plain at dawn.",
    "neishan": "A dim palace hall at night: an elegant emperor in a pale yellow robe sits slumped, a long memorial scroll written in red (abstract strokes, no legible characters) unrolled on the floor before him, an official kneeling, the young crown prince standing aside in shock.",
    "nanxing": "An imperial barge fleet with plain yellow canopies sailing down the Grand Canal at dusk away from the north, courtiers on deck looking back, winter willows.",
    "qingming": "A lively scene of Bianjing in the manner of Along the River During the Qingming Festival: the arched Rainbow Bridge crowded with people, boats on the Bian canal, shops, camels, carts, festive spring day.",
    "flood": "The Yellow River bursting its dikes on the North China plain, muddy water flooding villages and fields, people on rooftops, officials and labourers carrying straw bundles to the breach.",
    "daoist_rite": "A grand Daoist ritual in a palace courtyard: Daoist priests in blue and white robes around an altar with incense, cranes flying overhead, the emperor watching from a pavilion.",
    "xixia": "Western Xia cavalry and envoys on the Helan mountain foothills, Tangut men with shaved crowns and fringes, felt cloaks, a Song border fort in the distance.",
    "tangluo": "The water-defence lines of Hebei: a vast network of ponds, dikes and willow-lined channels with small watch-towers, labourers deepening a channel, soldiers patrolling on a dike, autumn reeds.",
    "jinjun_review": "A review of the palace guard army on a drill ground in Bianjing: ranks of soldiers in lamellar armour, many gaps in the ranks, old men and boys among them, officers in purple robes on a reviewing stand.",
    "goryeo_envoy": "A Song embassy ship with plain sails arriving at a Goryeo harbour, Korean officials in robes greeting Song envoys on a wooden pier, green hills.",
    "liao_envoy": "A Khitan envoy with temple locks in a blue round-collar robe bowing in a Song palace hall, presenting a blank letter, Song officials watching thoughtfully.",
    "military_drill": "Song soldiers training with crossbows and spears on a frontier drill field, a veteran general watching, new conscripts in rows, banners plain, crisp autumn day.",
    "court_debate": "A Song court audience in the Chuigong Hall: officials in purple, crimson and green robes with long-winged hats arguing before the emperor on a dais, ivory tablets raised.",
}
for eid, desc in EV.items():
    add(f"event.{eid}", "events", LAND, "SUBJECT: Event illustration, a single dramatic scene painted on pale silk: " + desc + " Wide landscape composition with clear focal point.", outkind="event")

# ------------------------------------------------------------------ ENDINGS
EN = {
    "f_bankrupt": "Empty imperial treasury vaults in Bianjing with open bare chests, unpaid palace guards clamouring at a palace gate with spears raised, a nervous official on the steps.",
    "f_dongnan": "The whole Jiangnan region in flames seen from a hill: rebel crowds with red head cloths holding the city of Hangzhou by the West Lake, smoke over the canals, Song officials fleeing by boat.",
    "f_minbian": "Bandit bands and starving villagers swarming over a burnt countryside of the North China plain, a county town gate broken, smoke rising from many places.",
    "e_neishan": "An abdication scene: the elegant emperor in pale yellow hands an imperial seal (blank) to the young crown prince in a palace hall, officials bowing deeply, snow falling outside the open doors.",
    "e_jingkang": "Winter, the fall of Bianjing: long lines of captives including an emperor and princes in plain robes being led north across a snowy plain by Jurchen horsemen with braided queues, the burning city in the distance, deeply sorrowful, restrained, no gore.",
    "e_nandu": "The court crossing the Yangtze southward: crowded boats on the broad river at dusk, officials and families looking back north to a smoky horizon, green southern hills ahead.",
    "e_quedi": "Victory on the Yellow River in early spring: Song armies with red cloaks on the riverbank watching Jurchen cavalry retreat north across the breaking ice, a veteran general and an upright official side by side, sunlight breaking through clouds.",
    "e_chengxia": "A humiliating peace outside the walls of Bianjing: Song officials kneeling before a Jurchen prince's tent offering boxes and maps (blank), long carts of silk and silver lined up, grey winter sky.",
    "e_huahe": "The Yellow River as a frontier: Song soldiers on the southern bank fortifying earthworks, on the far northern bank Jurchen banners (plain) and smoke over lost towns, cold wind.",
    "e_yanyun": "Triumphant peace at the northern frontier: Song soldiers manning the walls of Yanjing and the Juyong pass in spring, farmers ploughing below, the Yan mountains green, a calm confident mood.",
    "e_baojing": "Peace and prosperity in Bianjing: a festive Lantern Festival night along the Bian canal, lanterns on the Rainbow Bridge, crowds, the palace in the distance, calm frontier implied by soldiers relaxed at a gate.",
    "e_chunchi": "Song and Khitan envoys exchanging gifts at a border river crossing under willows in spring, Khitan horsemen and Song officials on either bank, wary peace.",
    "e_liuzei": "A gloomy palace: the emperor absorbed in painting a bird-and-flower picture in a quiet studio, while in the shadowed corridor behind him favourites in purple robes whisper and pass sealed documents, a melancholic dusk.",
    "e_open": "A lone watchtower on the northern frontier at dusk, the Song guard looking north into a gathering dark grey storm over the steppe, uncertain mood.",
}
for eid, desc in EN.items():
    add(f"ending.{eid}", "endings", LAND, "SUBJECT: Ending illustration, a single evocative scene painted on pale silk: " + desc + " Wide landscape composition.", outkind="ending")

# ------------------------------------------------------------------ APP ICON (desktop/icon-src/icon.png)
add("icon.app", "appicon", "Square 1:1 aspect ratio (1024x1024).",
    "SUBJECT: A square desktop application icon, bold and readable at small sizes: a round celadon (Ru-ware sky blue-green) jade disc "
    "with a subtle crackle glaze, centred on a deep ink-teal square with softly rounded corners; on the disc, a clean pale silver-gold "
    "silhouette of a Northern Song black futou hat with its two long straight horizontal wings, seen from the front, perfectly symmetric; "
    "a thin silver ring around the disc. Flat, elegant, minimal, no background scene.", outkind="icon")

