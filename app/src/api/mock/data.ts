// Fixture data for mock mode, transcribed from docs/TIANBAO_751_OUTLINE.md.
// Numbers marked 【虚】 in the outline are game values, not history.
import type { Army, Character, Faction, MemorialItem, Office, Op, Region } from '../types';

export interface ResourceDef {
  id: string;
  name: string;
  initial: number;
  min?: number;
  max?: number;
  unit: string;
  hidden?: boolean;
  estimate_width?: number;
  /** +1: higher is better for the player, -1: higher is worse. */
  polarity: 1 | -1;
}

export const RESOURCES: ResourceDef[] = [
  { id: 'treasury', name: '国库', initial: 3000, min: 0, unit: '万贯', polarity: 1 },
  { id: 'grain', name: '太仓粮储', initial: 2500, min: 0, unit: '万石', polarity: 1 },
  { id: 'authority', name: '君威', initial: 68, min: 0, max: 100, unit: '点', polarity: 1 },
  { id: 'morale', name: '民心', initial: 62, min: 0, max: 100, unit: '点', polarity: 1 },
  { id: 'corruption', name: '吏治积弊', initial: 55, min: 0, max: 100, unit: '点', polarity: -1 },
  { id: 'frontier_pressure', name: '边患', initial: 45, min: 0, max: 100, unit: '点', polarity: -1 },
  { id: 'an_ambition', name: '禄山异志', initial: 40, min: 0, max: 100, unit: '点', hidden: true, estimate_width: 8, polarity: -1 },
  { id: 'fanzhen_power', name: '外重内轻', initial: 70, min: 0, max: 100, unit: '点', polarity: -1 },
  { id: 'court_strife', name: '朝堂倾轧', initial: 50, min: 0, max: 100, unit: '点', polarity: -1 },
  { id: 'rebellion_risk', name: '渔阳鼙鼓', initial: 30, min: 0, max: 100, unit: '点', polarity: -1 },
];

export const CRISIS_BANDS = [
  { max: 39, name: '承平' },
  { max: 59, name: '风闻' },
  { max: 79, name: '山雨欲来' },
  { max: 100, name: '鼙鼓动地' },
];

export const FACTIONS: Faction[] = [
  { id: 'tang', name: '唐廷', relations: {} },
  { id: 'yan', name: '大燕', relations: { tang: -100 } },
  { id: 'tubo', name: '吐蕃', relations: { tang: -50 } },
  { id: 'nanzhao', name: '南诏', relations: { tang: -20 } },
  { id: 'khitan_xi', name: '契丹·奚', relations: { tang: -60 } },
  { id: 'dashi', name: '大食', relations: { tang: -30 } },
  { id: 'huihe', name: '回纥', relations: { tang: 20 } },
];

type RegionDef = Region & { foreign?: boolean; jiedushi?: string };

const st = (p: number, o: number, d: number, t: number, g: number) => ({
  prosperity: p,
  order: o,
  defense: d,
  tax: t,
  grain: g,
});

export const REGIONS: RegionDef[] = [
  { id: 'jingji', name: '京畿', seat: '长安', stats: st(80, 75, 45, 20, 10), controller: 'tang', adjacency: { tongguan: 1, shuofang: 1, hedong: 1, shannan: 1, longyou: 2, hexi: 2, jiannan: 2 } },
  { id: 'tongguan', name: '潼关', seat: '潼关', stats: st(30, 70, 85, 2, 0), controller: 'tang', adjacency: { jingji: 1, duji: 1, hedong: 1 } },
  { id: 'duji', name: '都畿', seat: '洛阳', stats: st(78, 70, 40, 16, 12), controller: 'tang', adjacency: { tongguan: 1, henan: 1, hebei: 1, hedong: 1, shannan: 1 } },
  { id: 'hedong', name: '河东', seat: '太原', jiedushi: '河东节度使', stats: st(60, 65, 65, 10, 8), controller: 'tang', adjacency: { jingji: 1, tongguan: 1, duji: 1, hebei: 1, fanyang: 1, shuofang: 1 } },
  { id: 'fanyang', name: '范阳', seat: '幽州', jiedushi: '范阳节度使', stats: st(55, 70, 80, 8, 6), controller: 'tang', adjacency: { hebei: 1, hedong: 1, pinglu: 1, khitan_xi: 1 } },
  { id: 'pinglu', name: '平卢', seat: '营州', jiedushi: '平卢节度使', stats: st(35, 65, 70, 3, 3), controller: 'tang', adjacency: { fanyang: 1, khitan_xi: 1 } },
  { id: 'hebei', name: '河北诸郡', seat: '魏州', stats: st(70, 68, 30, 14, 12), controller: 'tang', adjacency: { fanyang: 1, hedong: 1, duji: 1, henan: 1 } },
  { id: 'henan', name: '河南道', seat: '汴州', stats: st(72, 70, 30, 15, 14), controller: 'tang', adjacency: { duji: 1, hebei: 1, huainan: 1, shannan: 1 } },
  { id: 'huainan', name: '淮南', seat: '扬州', stats: st(75, 72, 25, 14, 16), controller: 'tang', adjacency: { henan: 1, jiangnan: 1, shannan: 1 } },
  { id: 'jiangnan', name: '江南', seat: '润州', stats: st(70, 72, 20, 15, 18), controller: 'tang', adjacency: { huainan: 1, shannan: 2, lingnan: 2 } },
  { id: 'shannan', name: '山南', seat: '襄阳', stats: st(55, 68, 30, 8, 8), controller: 'tang', adjacency: { jiannan: 2, jingji: 1, duji: 1, henan: 1, huainan: 1 } },
  { id: 'jiannan', name: '剑南', seat: '成都', jiedushi: '剑南节度使', stats: st(65, 62, 50, 10, 10), controller: 'tang', adjacency: { longyou: 2, nanzhao: 2, tubo: 2 } },
  { id: 'longyou', name: '陇右', seat: '鄯州', jiedushi: '陇右节度使', stats: st(40, 65, 75, 4, 4), controller: 'tang', adjacency: { hexi: 1, tubo: 1 } },
  { id: 'hexi', name: '河西', seat: '凉州', jiedushi: '河西节度使', stats: st(45, 66, 72, 4, 5), controller: 'tang', adjacency: { shuofang: 1, tubo: 1, beiting: 2, anxi: 3 } },
  { id: 'shuofang', name: '朔方', seat: '灵州', jiedushi: '朔方节度使', stats: st(40, 66, 72, 4, 4), controller: 'tang', adjacency: { huihe: 1 } },
  { id: 'anxi', name: '安西', seat: '龟兹', jiedushi: '安西四镇节度使', stats: st(35, 60, 65, 2, 2), controller: 'tang', adjacency: { beiting: 1, tubo: 2 } },
  { id: 'beiting', name: '北庭', seat: '庭州', jiedushi: '北庭节度使', stats: st(30, 60, 62, 2, 2), controller: 'tang', adjacency: { anxi: 1 } },
  { id: 'lingnan', name: '岭南', seat: '广州', jiedushi: '岭南五府经略使', stats: st(55, 60, 30, 6, 6), controller: 'tang', adjacency: { nanzhao: 3 } },
  { id: 'tubo', name: '吐蕃', foreign: true, stats: {}, controller: 'tubo', adjacency: {} },
  { id: 'nanzhao', name: '南诏', foreign: true, stats: {}, controller: 'nanzhao', adjacency: {} },
  { id: 'khitan_xi', name: '契丹·奚', foreign: true, stats: {}, controller: 'khitan_xi', adjacency: {} },
  { id: 'huihe', name: '回纥', foreign: true, stats: {}, controller: 'huihe', adjacency: {} },
];

export const OFFICES: Office[] = [
  { id: 'emperor', name: '皇帝', holder: 'xuanzong' },
  { id: 'you_xiang', name: '右相', holder: 'li_linfu' },
  { id: 'zuo_xiang', name: '左相', holder: 'chen_xilie' },
  { id: 'fanyang_jds', name: '范阳节度使', holder: 'an_lushan' },
  { id: 'pinglu_jds', name: '平卢节度使', holder: 'an_lushan' },
  { id: 'hedong_jds', name: '河东节度使', holder: null },
  { id: 'shuofang_jds', name: '朔方节度使', holder: 'li_linfu' },
  { id: 'longyou_jds', name: '陇右节度使', holder: 'geshu_han' },
  { id: 'anxi_jds', name: '安西四镇节度使', holder: 'gao_xianzhi' },
  { id: 'hexi_jds', name: '河西节度使', holder: 'an_sishun' },
  { id: 'jiannan_jds', name: '剑南节度使', holder: 'xianyu_zhongtong' },
  { id: 'jingzhao_yin', name: '京兆尹', holder: null },
];

type CharDef = Character & { bloc: string };

const ch = (
  id: string,
  name: string,
  title: string,
  bloc: string,
  region: string,
  traits: [number, number, number],
  persona: string,
  speech_style: string,
  offices: string[] = [],
): CharDef => ({
  id,
  name,
  title,
  bloc,
  region,
  faction: 'tang',
  office: offices[0] ?? null,
  offices,
  traits: { ability: traits[0], loyalty: traits[1], ambition: traits[2] },
  persona,
  speech_style,
  status: 'alive',
});

export const CHARACTERS: CharDef[] = [
  ch('xuanzong', '李隆基', '皇帝', '', 'jingji', [7, 10, 0], '大唐天子，在位近四十年，倦政而犹有威严。', '', ['emperor']),
  ch('li_linfu', '李林甫', '右相', 'xiang', 'jingji', [8, 6, 7], '右相，执政近二十年，善于揣摩上意，排斥异己，主张以蕃将镇守边疆。', '措辞周密，先颂圣而后转折，从不正面否定。', ['you_xiang', 'shuofang_jds']),
  ch('yang_guozhong', '杨国忠', '御史中丞·判度支', 'yang', 'jingji', [5, 5, 8], '贵妃从祖兄，精于算账、急于立功。', '夸张、爱表功，好用数字压人。'),
  ch('yang_guifei', '杨玉环', '贵妃', 'yang', 'jingji', [4, 8, 2], '娇憨而不干政，深得圣宠。', '口语亲昵，谈宴乐、诗与荔枝。'),
  ch('gao_lishi', '高力士', '骠骑大将军', 'neiting', 'jingji', [7, 10, 3], '内廷宿老，侍奉陛下数十年，谨守本分，只在独对时才直言。', '自称老奴，话少而点到为止。'),
  ch('li_heng', '李亨', '皇太子', 'donggong', 'jingji', [6, 7, 5], '隐忍谨慎，东宫屡遭构陷。', '回答之前先请罪，绝不议论边事。'),
  ch('chen_xilie', '陈希烈', '左相', 'xiang', 'jingji', [4, 5, 3], '左相，凡事附和右相。', '唯诺，常言「右相所言极是」。', ['zuo_xiang']),
  ch('an_lushan', '安禄山', '平卢·范阳节度使', 'fanyang', 'jingji', [8, 4, 9], '平卢、范阳节度使，东平郡王。体态肥硕，以胡人憨直自处，深得玄宗与贵妃宠信。', '自称臣胡人，言辞憨直诙谐，遇到问兵权的事就转而表忠心。', ['fanyang_jds', 'pinglu_jds']),
  ch('shi_siming', '史思明', '平卢兵马使', 'fanyang', 'pinglu', [8, 3, 7], '安禄山部将，鹰视狼顾。', '寡言，语带锋芒。'),
  ch('ji_wen', '吉温', '河东节度副使(求)', 'fanyang', 'jingji', [5, 3, 6], '酷吏出身，依附安禄山。', '谄媚而急切。'),
  ch('geshu_han', '哥舒翰', '陇右节度使', 'xibei', 'longyou', [8, 7, 4], '突骑施后裔，豪爽刚烈，鄙视安禄山。', '酒后直言，声若洪钟。', ['longyou_jds']),
  ch('gao_xianzhi', '高仙芝', '安西四镇节度使', 'xibei', 'jingji', [8, 7, 4], '高句丽后裔，骁勇而贪功，入朝献俘。', '说话简短，语带锐气。', ['anxi_jds']),
  ch('feng_changqing', '封常清', '安西节度判官', 'xibei', 'anxi', [8, 9, 3], '貌陋而有干才，文辞犀利，务实。', '条分缕析，不事虚饰。'),
  ch('an_sishun', '安思顺', '河西节度使', 'xibei', 'hexi', [6, 7, 3], '粟特裔边帅，与安禄山有亲。', '稳重持平。', ['hexi_jds']),
  ch('guo_ziyi', '郭子仪', '朔方军将', 'xibei', 'shuofang', [9, 9, 2], '宽厚稳重，久历行伍。', '谦和而有分寸。'),
  ch('li_guangbi', '李光弼', '朔方副将', 'xibei', 'shuofang', [9, 8, 3], '严厉寡言，治军有法。', '言简意赅。'),
  ch('yan_zhenqing', '颜真卿', '殿中侍御史', 'qingliu', 'jingji', [7, 10, 2], '刚直，引经据典，不避权贵。', '引经据典，词气凛然。'),
  ch('yan_gaoqing', '颜杲卿', '范阳幕府属官', 'qingliu', 'fanyang', [7, 10, 1], '外表恭顺，内心忠义，身在范阳幕中。', '言辞谨慎，暗藏机锋。'),
  ch('xianyu_zhongtong', '鲜于仲通', '剑南节度使', 'yang', 'jiannan', [4, 6, 4], '杨国忠所荐，主张征讨南诏。', '慷慨而轻敌。', ['jiannan_jds']),
  ch('bian_lingcheng', '边令诚', '监军宦官', 'neiting', 'jingji', [4, 6, 5], '谨小慎微，借皇命狐假虎威。', '阴声细语，常以「奉旨」压人。'),
];

export const BLOCS: Record<string, { name: string; color: string }> = {
  xiang: { name: '相党', color: 'var(--zise)' },
  yang: { name: '杨氏外戚', color: 'var(--zhusha)' },
  donggong: { name: '东宫', color: 'var(--shiqing)' },
  neiting: { name: '内廷', color: 'var(--shiqing-deep)' },
  fanyang: { name: '范阳系', color: 'var(--shilv)' },
  xibei: { name: '西北边帅', color: 'var(--zheshi)' },
  qingliu: { name: '清流', color: 'var(--mo-soft)' },
};

export const ARMIES: Army[] = [
  { id: 'jinjun', name: '京师禁军', faction: 'tang', region: 'jingji', strength: 40000, commander: 'gao_lishi', quality: 0.7 },
  { id: 'duji_army', name: '东都留守兵', faction: 'tang', region: 'duji', strength: 10000, quality: 0.7 },
  { id: 'hedong_army', name: '河东军', faction: 'tang', region: 'hedong', strength: 55000, quality: 1.0 },
  { id: 'fanyang_army', name: '范阳军', faction: 'tang', region: 'fanyang', strength: 91400, commander: 'an_lushan', loyal_to: 'an_lushan', quality: 1.2 },
  { id: 'pinglu_army', name: '平卢军', faction: 'tang', region: 'pinglu', strength: 37500, commander: 'shi_siming', loyal_to: 'an_lushan', quality: 1.1 },
  { id: 'jiannan_army', name: '剑南军', faction: 'tang', region: 'jiannan', strength: 30900, commander: 'xianyu_zhongtong', quality: 0.9 },
  { id: 'longyou_army', name: '陇右军', faction: 'tang', region: 'longyou', strength: 75000, commander: 'geshu_han', quality: 1.1 },
  { id: 'hexi_army', name: '河西军', faction: 'tang', region: 'hexi', strength: 73000, commander: 'an_sishun', quality: 1.0 },
  { id: 'shuofang_army', name: '朔方军', faction: 'tang', region: 'shuofang', strength: 64700, commander: 'guo_ziyi', quality: 1.1 },
  { id: 'anxi_army', name: '安西四镇', faction: 'tang', region: 'anxi', strength: 24000, commander: 'gao_xianzhi', quality: 1.2 },
  { id: 'beiting_army', name: '北庭军', faction: 'tang', region: 'beiting', strength: 20000, quality: 1.0 },
  { id: 'lingnan_army', name: '岭南五府', faction: 'tang', region: 'lingnan', strength: 15400, quality: 0.8 },
  { id: 'tubo_army', name: '吐蕃军', faction: 'tubo', region: 'tubo', strength: 80000, quality: 1.0 },
  { id: 'nanzhao_army', name: '南诏军', faction: 'nanzhao', region: 'nanzhao', strength: 40000, quality: 0.9 },
  { id: 'khitan_army', name: '契丹·奚', faction: 'khitan_xi', region: 'khitan_xi', strength: 50000, quality: 0.9 },
];

export const REBEL_ROUTE = ['fanyang', 'hebei', 'duji', 'tongguan', 'jingji'];
export const CANAL_ROUTE = ['jiangnan', 'huainan', 'henan', 'duji', 'tongguan', 'jingji'];

const res = (resource: string, delta: number, reason: string): Op => ({ op: 'adjust_resource', resource, delta, reason });
const flag = (key: string): Op => ({ op: 'set_flag', key, value: true });

export const MEMORIALS: MemorialItem[] = [
  // ---- T0 天宝十载春（序章）
  {
    id: 't0_hedong', turn: 0, region: 'hedong', title: '河东节度出缺',
    summary: '河东节度使出缺。安禄山上表，请以平卢、范阳之兵兼领河东，并荐吉温为节度副使。三镇若归一人，北边之兵将尽在其掌中。',
    illustration: 'event.hedong_grant',
    advisors: [
      { character: 'li_linfu', stance: 'support', line: '陛下圣明。蕃将无党援，可专任，禄山兼领河东，正可省朝廷西顾之忧。' },
      { character: 'gao_lishi', stance: 'neutral', line: '老奴不敢妄议边事……此事，陛下不妨单独垂询。' },
      { character: 'yan_zhenqing', stance: 'oppose', line: '三镇之兵几半天下，授于一人，非社稷之福。' },
    ],
    options: [
      { id: 'deny', label: '驳回，另择河东留后', hint: '外重内轻 −3', ops: [flag('hedong_denied'), res('fanzhen_power', -3, '另择河东留后')] },
      { id: 'deny_reward', label: '驳回并厚赐金帛以安其心', hint: '外重内轻 −3　国库 −60　禄山异志 −2', ops: [flag('hedong_denied'), res('fanzhen_power', -3, '另择河东留后'), res('treasury', -60, '赐安禄山金帛'), res('an_ambition', -2, '恩赏安抚')] },
      { id: 'grant', label: '照准，并赐铁券', hint: '外重内轻 +8　禄山异志 +3', ops: [flag('hedong_to_an'), res('fanzhen_power', 8, '安禄山兼领三镇'), res('an_ambition', 3, '兵权日重')] },
    ],
  },
  {
    id: 't0_xier', turn: 0, title: '禄山生辰·洗儿之礼',
    summary: '正月安禄山生辰，贵妃请于宫中行「洗儿」之礼，赐锦绣襁褓。宫中笑语，外朝侧目。',
    illustration: 'event.xier',
    advisors: [
      { character: 'yang_guozhong', stance: 'support', line: '厚赐以示恩宠，禄山必感激涕零，臣以为所费不过三十万贯。' },
      { character: 'yan_zhenqing', stance: 'oppose', line: '外臣出入禁中，礼制不宜，恐启非分之心。' },
    ],
    options: [
      { id: 'routine', label: '依常例赏赐，不许其出入禁中', hint: '朝堂倾轧 −1', ops: [res('court_strife', -1, '礼制有度')] },
      { id: 'lavish', label: '厚赐并许其出入宫禁', hint: '吏治积弊 +2　朝堂倾轧 +3', ops: [res('corruption', 2, '宫禁失度'), res('court_strife', 3, '外朝侧目')] },
    ],
  },
  {
    id: 't0_nanzhao', turn: 0, region: 'jiannan', title: '南诏陷姚州',
    summary: '云南太守张虔陀凌辱南诏王阁罗凤，阁罗凤反攻，陷姚州。剑南节度使鲜于仲通请发兵八万讨伐。',
    illustration: 'event.nanzhao',
    advisors: [
      { character: 'yang_guozhong', stance: 'support', line: '蛮夷小丑，八万之众一鼓可平，剑南军粮臣已核过，足支两季。' },
      { character: 'gao_xianzhi', stance: 'oppose', line: '西南山险瘴深，劳师远征，胜之不武，败则损威。' },
    ],
    options: [
      { id: 'appease', label: '遣使查办张虔陀之过，许南诏谢罪', hint: '南诏请和，边患 −4（次季）', ops: [flag('nanzhao_appeased'), res('court_strife', 1, '杨国忠不悦')] },
      { id: 'campaign', label: '准鲜于仲通发兵征讨', hint: '次季将有军报', ops: [flag('nanzhao_campaign'), res('treasury', -120, '南征军费')] },
    ],
  },
  {
    id: 't0_anxi', turn: 0, region: 'anxi', title: '高仙芝献俘·诸胡割耳',
    summary: '高仙芝入朝献俘。朝议欲调高仙芝镇河西，河西诸胡割耳请留安思顺。高仙芝又请讨石国余党。',
    illustration: 'event.anxi',
    advisors: [
      { character: 'li_linfu', stance: 'support', line: '诸胡之心可用，留安思顺于河西，西陲可安。' },
      { character: 'geshu_han', stance: 'neutral', line: '西北之地，当用汉将，蕃将可用而不可专。' },
      { character: 'gao_xianzhi', stance: 'oppose', line: '石国余党勾连大食，臣请一旅之师，必献其王。' },
    ],
    options: [
      { id: 'restrain', label: '留安思顺于河西，命高仙芝不得擅启边衅', hint: '边患 −1', ops: [flag('anxi_restrained'), res('frontier_pressure', -1, '西陲安堵')] },
      { id: 'deep', label: '准高仙芝讨石国余党', hint: '次季或有怛罗斯之战', ops: [flag('anxi_deep_campaign'), res('authority', 1, '武功可期')] },
    ],
  },
  {
    id: 't0_huaqing', turn: 0, region: 'jingji', title: '度支奏府库充盈',
    summary: '度支奏报府库充盈，请修缮华清宫以备冬幸。另有议者请以此款整训京畿禁军。',
    illustration: 'event.huaqing',
    advisors: [
      { character: 'yang_guozhong', stance: 'support', line: '今岁府库之盈，开元以来未有，此皆度支之功也。修华清宫，不过九牛一毛。' },
      { character: 'gao_lishi', stance: 'oppose', line: '北衙宿卫，久不操练了。' },
    ],
    options: [
      { id: 'train', label: '拨款整训京畿禁军（四季工程）', hint: '国库 −40/季　完成后京畿防务 +10', ops: [{ op: 'start_project', name: '禁军整训', region: 'jingji', turns: 4, cost_per_turn: { treasury: 40 } }] },
      { id: 'palace', label: '营建华清宫', hint: '国库 −100　吏治积弊 +3', ops: [res('treasury', -100, '营建华清宫'), res('corruption', 3, '营造靡费')] },
    ],
  },
  // ---- T1 天宝十载夏
  {
    id: 't1_khitan_plan', turn: 1, region: 'fanyang', title: '禄山请讨契丹',
    summary: '安禄山奏请秋季讨伐契丹，并请调河东兵马助战。',
    illustration: 'event.khitan',
    advisors: [
      { character: 'li_linfu', stance: 'support', line: '禄山久在边地，熟知虏情，可从其请。' },
      { character: 'geshu_han', stance: 'oppose', line: '借讨虏之名并河东之兵，其心可知！' },
    ],
    options: [
      { id: 'forbid', label: '禁止河东兵出境', hint: '禄山异志 +1', ops: [flag('an_forbidden_khitan'), res('an_ambition', 1, '请兵被驳')] },
      { id: 'allow', label: '准奏', hint: '外重内轻 +2', ops: [res('fanzhen_power', 2, '河东兵归禄山调度')] },
    ],
  },
  {
    id: 't1_grain', turn: 1, region: 'jingji', title: '关中夏粮不足',
    summary: '关中夏粮歉收，江淮漕船待发。京师米价日涨。',
    illustration: 'event.canal',
    advisors: [
      { character: 'yang_guozhong', stance: 'neutral', line: '和籴可解燃眉，所费八十万贯。' },
      { character: 'yan_zhenqing', stance: 'support', line: '漕运乃国之命脉，宜修汴渠，以图长久。' },
    ],
    options: [
      { id: 'buy', label: '关中和籴', hint: '国库 −80　粮储 +120', ops: [res('treasury', -80, '关中和籴'), res('grain', 120, '和籴入仓')] },
      { id: 'canal', label: '增修漕运（三季工程）', hint: '国库 −50/季　完成后粮产 +', ops: [{ op: 'start_project', name: '疏浚汴渠', region: 'henan', turns: 3, cost_per_turn: { treasury: 50 } }] },
    ],
  },
  {
    id: 't1_donggong', turn: 1, title: '中书奏东宫交结边将',
    summary: '中书奏报：东宫属官与边将书信往来，请下有司推问。',
    advisors: [
      { character: 'li_linfu', stance: 'support', line: '东宫属官交结边将，事关社稷，不可不察。' },
      { character: 'gao_lishi', stance: 'oppose', line: '太子仁孝，此事……恐有人构陷。' },
    ],
    options: [
      { id: 'protect', label: '庇护东宫，交大理寺复核', hint: '朝堂倾轧 +2　太子感恩', ops: [res('court_strife', 2, '相党不满'), flag('donggong_protected')] },
      { id: 'allow', label: '默许右相办案', hint: '朝堂倾轧 +5', ops: [res('court_strife', 5, '东宫被构')] },
    ],
  },
  // ---- T2 天宝十载秋
  {
    id: 't2_shuofang', turn: 2, region: 'shuofang', title: '朔方留后人选',
    summary: '李林甫遥领朔方，有意推荐安思顺为留后。',
    advisors: [
      { character: 'li_linfu', stance: 'support', line: '安思顺久镇河西，老成持重。' },
      { character: 'gao_lishi', stance: 'oppose', line: '朔方军中，郭子仪素有威望。' },
    ],
    options: [
      { id: 'guo', label: '以郭子仪知朔方留后', hint: '朔方可恃', ops: [flag('shuofang_reliable'), res('court_strife', 1, '右相不悦')] },
      { id: 'an', label: '照右相之意', hint: '外重内轻 +2', ops: [res('fanzhen_power', 2, '安氏兄弟并镇')] },
    ],
  },
  {
    id: 't2_tax', turn: 2, title: '秋税入库·括户之议',
    summary: '秋税入库，然逃户日多，籍帐不实。',
    advisors: [
      { character: 'yan_zhenqing', stance: 'support', line: '请遣御史分道核查，以正籍帐。' },
      { character: 'yang_guozhong', stance: 'oppose', line: '臣有一法，变造轻货充库，可得百五十万贯。' },
    ],
    options: [
      { id: 'audit', label: '派御史分道核查', hint: '吏治积弊 −3　民心 −1', ops: [res('corruption', -3, '御史出巡'), res('morale', -1, '括户扰民')] },
      { id: 'squeeze', label: '准杨国忠变造轻货', hint: '国库 +150　吏治积弊 +5', ops: [res('treasury', 150, '变造轻货'), res('corruption', 5, '聚敛')] },
    ],
  },
];

export interface EventDef {
  id: string;
  title: string;
  text: string;
  turn?: number;
  illustration?: string;
  requires?: string;
  forbids?: string;
  effects: Op[];
  choices?: { id: string; text: string; hint?: string; effects: Op[] }[];
  default_choice?: string;
}

export const EVENTS: EventDef[] = [
  {
    id: 'hedong_grant', turn: 1, title: '河东归禄山', forbids: 'hedong_denied', illustration: 'event.hedong_grant',
    text: '诏下，安禄山兼领河东节度使。三镇旌节并于一门，范阳、平卢、河东之兵，北边之半。',
    effects: [res('fanzhen_power', 8, '安禄山兼领三镇'), res('an_ambition', 3, '兵权日重'), flag('hedong_to_an')],
  },
  {
    id: 'an_returns', turn: 1, title: '禄山辞归范阳', illustration: 'event.an_returns',
    text: '安禄山上表辞归范阳，言边地事急，不敢久留京师。临行，拜贵妃于前，拜陛下于后。',
    effects: [{ op: 'move_character', character: 'an_lushan', region: 'fanyang' }],
    choices: [
      { id: 'let_go', text: '厚赐遣归', hint: '禄山异志 −1　国库 −40', effects: [res('an_ambition', -1, '恩遇优渥'), res('treasury', -40, '赏赐')] },
      { id: 'escort', text: '遣中使护送，察其军容', hint: '情报：异志区间收窄', effects: [flag('intel:an_ambition')] },
      { id: 'detain', text: '以宿卫为名留其在京', hint: '外重内轻 −4　禄山异志 +5', effects: [res('fanzhen_power', -4, '主帅不在镇'), res('an_ambition', 5, '疑惧'), flag('an_detained')] },
    ],
    default_choice: 'let_go',
  },
  {
    id: 'xier_defeat', turn: 1, title: '西洱河之败', requires: 'nanzhao_campaign', illustration: 'event.xier_defeat',
    text: '鲜于仲通兵八万渡西洱河，为南诏所败，士卒死者六万。杨国忠匿其败状，反为叙功。',
    effects: [res('grain', -150, '军粮丧失'), res('morale', -4, '败报传闻'), res('frontier_pressure', 6, '南诏附蕃'), { op: 'adjust_army', army: 'jiannan_army', delta: -30000, reason: '西洱河之败' }, flag('xier_defeat')],
    choices: [
      { id: 'punish', text: '追究仲通败责', hint: '君威 +3　朝堂倾轧 +4', effects: [res('authority', 3, '赏罚分明'), res('court_strife', 4, '杨氏怨望'), flag('guozhong_restrained')] },
      { id: 'condone', text: '默许叙功', hint: '吏治积弊 +4　君威 −2', effects: [res('corruption', 4, '掩败叙功'), res('authority', -2, '是非不明')] },
    ],
    default_choice: 'condone',
  },
  {
    id: 'nanzhao_tribute', turn: 1, title: '南诏请和', requires: 'nanzhao_appeased', illustration: 'event.nanzhao_tribute',
    text: '阁罗凤遣使谢罪，愿复修职贡。张虔陀之罪既明，西南边陲渐安。',
    effects: [res('frontier_pressure', -4, '南诏请和')],
  },
  {
    id: 'khitan_defeat', turn: 2, title: '土护真水之败', forbids: 'an_forbidden_khitan', illustration: 'event.khitan_defeat',
    text: '安禄山讨契丹，会大雨，弓弩筋胶皆弛，大败于土护真水。禄山仅以身免，范阳军折损二万。削藩之机，或在此时。',
    effects: [{ op: 'adjust_army', army: 'fanyang_army', delta: -20000, reason: '土护真水之败' }, flag('an_weakened')],
    choices: [
      { id: 'blame', text: '遣使问罪', hint: '君威 +3　禄山异志 +4', effects: [res('authority', 3, '问罪'), res('an_ambition', 4, '惧罪')] },
      { id: 'console', text: '优诏慰抚', hint: '禄山异志 −2　君威 −2', effects: [res('an_ambition', -2, '慰抚'), res('authority', -2, '纵容败将')] },
      { id: 'split', text: '乘机分平卢另授他人', hint: '外重内轻 −8　禄山异志 +6', effects: [res('fanzhen_power', -8, '分镇'), res('an_ambition', 6, '削权')] },
    ],
    default_choice: 'console',
  },
  {
    id: 'talas', turn: 2, title: '怛罗斯之战', requires: 'anxi_deep_campaign', illustration: 'event.talas',
    text: '高仙芝深入七百余里，与大食战于怛罗斯城。葛逻禄临阵倒戈，唐军大败。',
    effects: [{ op: 'adjust_army', army: 'anxi_army', delta: -15000, reason: '怛罗斯之战' }, res('frontier_pressure', 5, '西域震动'), res('authority', -2, '败报')],
  },
  {
    id: 'li_linfu_death', turn: 7, title: '李林甫薨', illustration: 'event.li_linfu_death',
    text: '右相李林甫病卒。相位出缺，朝中诸党各怀心思。',
    effects: [{ op: 'set_character_status', character: 'li_linfu', status: 'dead' }, res('court_strife', 5, '相位出缺'), flag('chancellor_vacant')],
  },
];

export interface EndingDef {
  id: string;
  kind: 'ending' | 'fail';
  title: string;
  text: string;
}

export const ENDINGS: EndingDef[] = [
  { id: 'E1', kind: 'ending', title: '天宝中兴·消弭兵祸', text: '天宝十四载冬，渔阳无鼙鼓之声。三镇之兵渐归朝廷，禄山入朝不复归镇，终老长安。史臣曰：盛世之倾，不在一夕；其不倾也，亦在积渐之间。' },
  { id: 'E2', kind: 'ending', title: '削藩而边陲失', text: '节度之兵既分，河北无事。然吐蕃乘虚东进，陇右、河西诸城相继告急。安史之祸弭矣，而边陲之患方殷。' },
  { id: 'E3', kind: 'ending', title: '再造唐室', text: '渔阳虽动，潼关不失。朔方之师东出，东都克复，叛军溃于河北。天下虽经兵燹，唐室犹存。' },
  { id: 'E4', kind: 'ending', title: '渔阳鼙鼓·历史重演', text: '潼关既失，车驾西幸。马嵬驿下，六军不发。陛下退居南内，太子即位于灵武。' },
  { id: 'E5', kind: 'ending', title: '杨氏擅国', text: '君威日替，朝政尽出杨门。禄山虽未举兵，而天下之心已离。' },
  { id: 'E6', kind: 'ending', title: '传位东宫', text: '陛下倦于万机，传位东宫。新君践祚，天宝之政遂成故事。' },
  { id: 'fail_changan', kind: 'fail', title: '长安不守', text: '叛军入京畿，宫阙焚于兵火。' },
  { id: 'fail_bankrupt', kind: 'fail', title: '帑竭兵变', text: '国库空竭，军粮不继，禁军哗变。' },
];

export const OBJECTIVES = [
  { id: 'peace', title: '弭兵', detail: '让「渔阳鼙鼓」不变红；若已起兵，守住潼关与长安。' },
  { id: 'supply', title: '足食足兵', detail: '国库与粮储全程不枯竭。' },
  { id: 'power', title: '皇权在握', detail: '终局时君威不低于五十，未内禅，未有马嵬之变。' },
];

/** Templated audience replies for mock mode, keyed by character. */
export const CHAT_LINES: Record<string, string[]> = {
  li_linfu: [
    '陛下圣明。臣以为此事不宜操切，然陛下既有垂问，臣斗胆直陈：边镇之事，宜专任蕃将，蕃将无党援，可保无虞。至于朝中议论纷纭者，不过书生之见耳。',
    '陛下所虑极是。只是……东宫近来与边将往还甚密，臣不敢不奏。',
  ],
  gao_lishi: [
    '老奴……不敢妄言。陛下既然问了，老奴只说一句：范阳之兵，已经太多了。',
    '老奴侍奉陛下四十年。外头的话，老奴听得多，说得少。陛下若信得过老奴，河北那边，不妨派个稳妥的人去看看。',
  ],
  an_lushan: [
    '臣胡人，不识汉家礼数，只知有陛下，不知有太子！陛下要臣守边，臣便守边；陛下要臣入朝，臣即刻便来。',
    '杨国忠那厮，屡屡在陛下面前说臣坏话，臣心里委屈，只是不敢说。臣的兵，都是陛下的兵。',
  ],
  yang_guozhong: [
    '陛下，臣已核过度支账目：今岁府库较去岁多出三百余万贯，此皆臣日夜督责之功。至于安禄山，此人必反，臣愿以项上人头担保！',
    '剑南军情，臣已尽知，些许小挫，不足挂齿。',
  ],
  yang_guifei: [
    '三郎今日怎么愁眉不展？岭南的荔枝刚到，尝一颗罢。前朝的事，妾不懂，只盼三郎多笑一笑。',
  ],
  li_heng: [
    '儿臣有罪……儿臣不敢议论边事，只愿父皇圣体康泰。',
  ],
  yan_zhenqing: [
    '臣闻《春秋》之义，人臣无将，将而必诛。安禄山兼领三镇，拥兵二十万，此非人臣所宜有也。臣请陛下早为之计。',
  ],
  geshu_han: [
    '陛下！那胡儿算什么东西？臣在陇右，吐蕃闻风丧胆。若禄山敢动，臣愿率陇右之兵，直捣范阳！',
  ],
  gao_xianzhi: ['西域诸胡，畏威而不怀德。臣请再出葱岭，必献大食之俘。'],
  feng_changqing: ['安西兵马两万四千，粮可支三季。臣以为守成为上，不宜再启边衅。'],
  guo_ziyi: ['朔方军士卒用命，粮械齐备。陛下若有差遣，臣万死不辞。'],
  li_guangbi: ['朔方可战之兵五万。军令既出，臣必遵行。'],
  chen_xilie: ['右相所言极是……臣以为，陛下圣裁便是。'],
  yan_gaoqing: ['范阳幕中，近来多置曳落河，又私造甲仗。臣身在其中，不敢多言，只请陛下留意。'],
  an_sishun: ['河西诸胡，皆愿效命。至于范阳之事，臣与禄山虽有亲，亦不敢不以实告：其兵过盛矣。'],
  shi_siming: ['末将只知听主帅号令。'],
  ji_wen: ['臣愿为陛下分忧，河东之事，交给臣便是。'],
  xianyu_zhongtong: ['南诏蛮夷，何足道哉！臣请再发兵五万，必擒阁罗凤。'],
  bian_lingcheng: ['奴婢奉旨监军，所见所闻，句句属实。'],
};

export const DEBATE_STANCE_TEXT: Record<string, { support: string; oppose: string; neutral: string }> = {
  xiang: {
    support: '陛下圣明，此议深合时宜。然行之宜缓，臣请先下中书详议。',
    oppose: '陛下圣明。只是此事牵动甚广，臣恐操之过急，反生事端。',
    neutral: '此事利弊参半，臣不敢擅断，请陛下圣裁。',
  },
  yang: {
    support: '臣已核过账目，此议可行，所费不过百万贯，收效十倍！',
    oppose: '此议若行，度支必然吃紧，臣以为万万不可。',
    neutral: '臣以为可再议，待度支核算之后再定不迟。',
  },
  fanyang: {
    support: '臣胡人，不懂大道理，只知陛下说好便是好！',
    oppose: '陛下，此议分明是有人要害臣！臣对陛下一片赤心啊！',
    neutral: '臣只知守边，朝中之事，不敢置喙。',
  },
  xibei: {
    support: '边事唯在得人。此议可行，臣愿效死力。',
    oppose: '纸上谈兵！边地之事，岂是朝中诸公所能知？',
    neutral: '兵者凶器，臣以为当先察虏情，再作计较。',
  },
  qingliu: {
    support: '《书》云：「若药不瞑眩，厥疾弗瘳。」此议正当其时。',
    oppose: '此议名为利国，实则害民，臣死不敢附和。',
    neutral: '臣请先遣御史察访，以实据定议。',
  },
  neiting: {
    support: '老奴以为……可行。',
    oppose: '老奴不敢多言，只是此事，恐非稳妥之计。',
    neutral: '老奴听陛下的。',
  },
  donggong: {
    support: '儿臣不敢妄议，然此议似可安社稷。',
    oppose: '儿臣有罪，儿臣以为……此事还请父皇三思。',
    neutral: '儿臣不敢议论国事。',
  },
};
