import type { HerbProperties, DoseRatioMap } from './types';

/**
 * 每味药的药性档案：四气五味、归经、功效标签、单价（文/10g，相对价格）。
 * 功效标签用于衡量两味药"药性相近"的程度。
 */
export const HERB_PROPERTIES: HerbProperties[] = [
  { name: '白芍', nature: '微寒', flavors: ['苦', '酸'], meridians: ['肝', '脾'], effects: ['养血', '柔肝', '止痛', '敛阴'], pricePer10g: 8 },
  { name: '赤芍', nature: '微寒', flavors: ['苦'], meridians: ['肝'], effects: ['清热', '凉血', '散瘀', '止痛'], pricePer10g: 7 },
  { name: '生地', nature: '寒', flavors: ['甘', '苦'], meridians: ['心', '肝', '肾'], effects: ['清热', '凉血', '养阴', '生津'], pricePer10g: 9 },
  { name: '熟地', nature: '微温', flavors: ['甘'], meridians: ['肝', '肾'], effects: ['补血', '滋阴', '益精'], pricePer10g: 12 },
  { name: '黄芪', nature: '微温', flavors: ['甘'], meridians: ['脾', '肺'], effects: ['补气', '固表', '升阳', '利水'], pricePer10g: 10 },
  { name: '当归', nature: '温', flavors: ['甘', '辛'], meridians: ['肝', '心', '脾'], effects: ['补血', '活血', '调经', '止痛'], pricePer10g: 11 },
  { name: '川芎', nature: '温', flavors: ['辛'], meridians: ['肝', '胆', '心包'], effects: ['活血', '行气', '祛风', '止痛'], pricePer10g: 9 },
  { name: '白术', nature: '温', flavors: ['苦', '甘'], meridians: ['脾', '胃'], effects: ['健脾', '益气', '燥湿', '利水'], pricePer10g: 9 },
  { name: '苍术', nature: '温', flavors: ['辛', '苦'], meridians: ['脾', '胃'], effects: ['燥湿', '健脾', '祛风', '散寒'], pricePer10g: 6 },
  { name: '茯苓', nature: '平', flavors: ['甘', '淡'], meridians: ['心', '脾', '肾'], effects: ['利水', '渗湿', '健脾', '宁心'], pricePer10g: 8 },
  { name: '党参', nature: '平', flavors: ['甘'], meridians: ['脾', '肺'], effects: ['补气', '健脾', '益肺', '生津'], pricePer10g: 10 },
  { name: '丹参', nature: '微寒', flavors: ['苦'], meridians: ['心', '心包', '肝'], effects: ['活血', '祛瘀', '凉血', '安神'], pricePer10g: 9 },
  { name: '甘草', nature: '平', flavors: ['甘'], meridians: ['心', '肺', '脾', '胃'], effects: ['补气', '调和', '润肺', '解毒'], pricePer10g: 5 },
  { name: '桂枝', nature: '温', flavors: ['辛', '甘'], meridians: ['心', '肺', '膀胱'], effects: ['发汗', '温通', '散寒', '助阳'], pricePer10g: 6 },
  { name: '柴胡', nature: '微寒', flavors: ['苦', '辛'], meridians: ['肝', '胆'], effects: ['解表', '疏肝', '升阳', '退热'], pricePer10g: 7 },
  { name: '黄芩', nature: '寒', flavors: ['苦'], meridians: ['肺', '胆', '脾', '胃'], effects: ['清热', '燥湿', '泻火', '解毒'], pricePer10g: 7 },
  { name: '黄连', nature: '寒', flavors: ['苦'], meridians: ['心', '脾', '胃', '肝'], effects: ['清热', '燥湿', '泻火', '解毒'], pricePer10g: 12 },
  { name: '黄柏', nature: '寒', flavors: ['苦'], meridians: ['肾', '膀胱'], effects: ['清热', '燥湿', '泻火', '退虚热'], pricePer10g: 8 },
  { name: '知母', nature: '寒', flavors: ['苦', '甘'], meridians: ['肺', '胃', '肾'], effects: ['清热', '泻火', '滋阴', '润燥'], pricePer10g: 8 },
  { name: '贝母', nature: '微寒', flavors: ['苦', '甘'], meridians: ['肺', '心'], effects: ['化痰', '止咳', '清热', '散结'], pricePer10g: 15 },
  { name: '杏仁', nature: '微温', flavors: ['苦'], meridians: ['肺', '大肠'], effects: ['止咳', '平喘', '润肠'], pricePer10g: 6 },
  { name: '桃仁', nature: '平', flavors: ['苦', '甘'], meridians: ['心', '肝', '大肠'], effects: ['活血', '祛瘀', '润肠'], pricePer10g: 6 },
  { name: '红花', nature: '温', flavors: ['辛'], meridians: ['心', '肝'], effects: ['活血', '通经', '散瘀', '止痛'], pricePer10g: 10 },
  { name: '枸杞', nature: '平', flavors: ['甘'], meridians: ['肝', '肾'], effects: ['滋补肝肾', '益精', '明目'], pricePer10g: 14 },
  { name: '菊花', nature: '微寒', flavors: ['辛', '甘', '苦'], meridians: ['肺', '肝'], effects: ['疏风', '清热', '平肝', '明目'], pricePer10g: 6 },
  { name: '薄荷', nature: '凉', flavors: ['辛'], meridians: ['肺', '肝'], effects: ['疏散风热', '清利头目', '透疹', '疏肝'], pricePer10g: 5 },
  { name: '陈皮', nature: '温', flavors: ['辛', '苦'], meridians: ['脾', '肺'], effects: ['理气', '健脾', '燥湿', '化痰'], pricePer10g: 5 },
  { name: '青皮', nature: '温', flavors: ['苦', '辛'], meridians: ['肝', '胆', '胃'], effects: ['疏肝', '破气', '消积', '化滞'], pricePer10g: 5 },
  { name: '半夏', nature: '温', flavors: ['辛'], meridians: ['脾', '胃', '肺'], effects: ['燥湿', '化痰', '降逆', '止呕'], pricePer10g: 7 },
  { name: '远志', nature: '温', flavors: ['苦', '辛'], meridians: ['心', '肾', '肺'], effects: ['安神', '益智', '祛痰', '消肿'], pricePer10g: 8 },
  { name: '酸枣仁', nature: '平', flavors: ['甘', '酸'], meridians: ['心', '肝', '胆'], effects: ['养心', '安神', '敛汗', '益阴'], pricePer10g: 13 },
  { name: '五味子', nature: '温', flavors: ['酸', '甘'], meridians: ['肺', '心', '肾'], effects: ['收敛', '固涩', '益气', '生津'], pricePer10g: 11 },
];

const propertyMap = new Map(HERB_PROPERTIES.map(p => [p.name, p]));

export function getProperties(name: string): HerbProperties | undefined {
  return propertyMap.get(name);
}

/**
 * 用量换算表：键名 `${原药}->${替用药}`，值为剂量倍数。
 * 没收录的药对默认 1.0（等量顶替），由药性相似度兜住差异。
 *
 * 依据：
 * - 生地偏清热凉血，熟地偏补血滋腻，以生地替熟地补血需加量，反过来清热需减量；
 * - 白术补脾力强、苍术燥烈偏化湿，互替时白术宜少、苍术宜多；
 * - 党参补气力缓、黄芪/人参力峻，党参顶替需加量；
 * - 黄芩清上焦、黄柏清下焦、黄连清心火，清热互替微调；
 * - 杏仁降气、桃仁入血，润肠互替略加；
 * - 青皮力猛于陈皮，青皮替陈皮宜减量。
 */
export const DOSE_RATIOS: DoseRatioMap = {
  '生地->熟地': 1.3,
  '熟地->生地': 0.7,
  '苍术->白术': 0.8,
  '白术->苍术': 1.2,
  '党参->黄芪': 1.2,
  '黄芪->党参': 0.8,
  '丹参->党参': 1.1,
  '党参->丹参': 1.0,
  '黄柏->黄芩': 1.0,
  '黄芩->黄柏': 1.1,
  '黄连->黄芩': 0.6,
  '黄芩->黄连': 1.4,
  '桃仁->杏仁': 1.2,
  '杏仁->桃仁': 1.0,
  '赤芍->白芍': 1.0,
  '白芍->赤芍': 0.9,
  '青皮->陈皮': 1.2,
  '陈皮->青皮': 0.8,
};

export function getDoseRatio(original: string, candidate: string): number {
  const r = DOSE_RATIOS[`${original}->${candidate}`];
  return r === undefined ? 1.0 : r;
}
