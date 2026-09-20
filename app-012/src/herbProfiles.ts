import type { HerbProfile, SubstituteSpec } from './types';

/** 每味药的性味、功效与单价（元/g），替代比价、比药性都查这张表 */
export const HERB_PROFILES: Record<string, HerbProfile> = {
  白芍: { herb: '白芍', nature: '凉', flavors: ['苦', '酸'], effects: ['养血', '柔肝', '敛阴'], pricePerGram: 0.6 },
  赤芍: { herb: '赤芍', nature: '凉', flavors: ['苦'], effects: ['清热凉血', '散瘀'], pricePerGram: 0.5 },
  生地: { herb: '生地', nature: '寒', flavors: ['甘', '苦'], effects: ['清热凉血', '养阴生津'], pricePerGram: 0.4 },
  熟地: { herb: '熟地', nature: '温', flavors: ['甘'], effects: ['补血滋阴', '益精填髓'], pricePerGram: 0.5 },
  黄芪: { herb: '黄芪', nature: '温', flavors: ['甘'], effects: ['补气升阳', '固表'], pricePerGram: 0.8 },
  当归: { herb: '当归', nature: '温', flavors: ['甘', '辛'], effects: ['补血活血', '调经'], pricePerGram: 0.9 },
  川芎: { herb: '川芎', nature: '温', flavors: ['辛'], effects: ['活血行气', '祛风止痛'], pricePerGram: 0.7 },
  白术: { herb: '白术', nature: '温', flavors: ['甘', '苦'], effects: ['健脾益气', '燥湿'], pricePerGram: 0.6 },
  苍术: { herb: '苍术', nature: '温', flavors: ['辛', '苦'], effects: ['燥湿健脾', '祛风'], pricePerGram: 0.5 },
  茯苓: { herb: '茯苓', nature: '平', flavors: ['甘', '淡'], effects: ['利水渗湿', '健脾宁心'], pricePerGram: 0.4 },
  党参: { herb: '党参', nature: '平', flavors: ['甘'], effects: ['补中益气', '生津'], pricePerGram: 0.7 },
  丹参: { herb: '丹参', nature: '凉', flavors: ['苦'], effects: ['活血祛瘀', '清心除烦'], pricePerGram: 0.6 },
  甘草: { herb: '甘草', nature: '平', flavors: ['甘'], effects: ['补脾益气', '调和诸药'], pricePerGram: 0.3 },
  桂枝: { herb: '桂枝', nature: '温', flavors: ['辛', '甘'], effects: ['发汗解肌', '温通经脉'], pricePerGram: 0.5 },
  柴胡: { herb: '柴胡', nature: '凉', flavors: ['苦', '辛'], effects: ['疏散退热', '疏肝解郁'], pricePerGram: 0.6 },
  黄芩: { herb: '黄芩', nature: '寒', flavors: ['苦'], effects: ['清热燥湿', '泻火'], pricePerGram: 0.5 },
  黄连: { herb: '黄连', nature: '寒', flavors: ['苦'], effects: ['清热燥湿', '泻火解毒'], pricePerGram: 1.2 },
  黄柏: { herb: '黄柏', nature: '寒', flavors: ['苦'], effects: ['清热燥湿', '泻火除蒸'], pricePerGram: 0.5 },
  知母: { herb: '知母', nature: '寒', flavors: ['苦', '甘'], effects: ['清热泻火', '滋阴润燥'], pricePerGram: 0.4 },
  贝母: { herb: '贝母', nature: '凉', flavors: ['苦', '甘'], effects: ['清热化痰', '止咳'], pricePerGram: 1.5 },
  杏仁: { herb: '杏仁', nature: '温', flavors: ['苦'], effects: ['降气止咳', '润肠通便'], pricePerGram: 0.6 },
  桃仁: { herb: '桃仁', nature: '平', flavors: ['苦', '甘'], effects: ['活血祛瘀', '润肠'], pricePerGram: 0.7 },
  红花: { herb: '红花', nature: '温', flavors: ['辛'], effects: ['活血通经', '散瘀止痛'], pricePerGram: 1.8 },
  枸杞: { herb: '枸杞', nature: '平', flavors: ['甘'], effects: ['滋补肝肾', '明目'], pricePerGram: 0.8 },
  菊花: { herb: '菊花', nature: '凉', flavors: ['甘', '苦'], effects: ['疏散风热', '平肝明目'], pricePerGram: 0.5 },
  薄荷: { herb: '薄荷', nature: '凉', flavors: ['辛'], effects: ['疏散风热', '清利头目'], pricePerGram: 0.4 },
  陈皮: { herb: '陈皮', nature: '温', flavors: ['辛', '苦'], effects: ['理气健脾', '燥湿化痰'], pricePerGram: 0.4 },
  青皮: { herb: '青皮', nature: '温', flavors: ['苦', '辛'], effects: ['疏肝破气', '消积'], pricePerGram: 0.4 },
  半夏: { herb: '半夏', nature: '温', flavors: ['辛'], effects: ['燥湿化痰', '降逆止呕'], pricePerGram: 0.9 },
  远志: { herb: '远志', nature: '温', flavors: ['苦', '辛'], effects: ['安神益智', '祛痰'], pricePerGram: 1.0 },
  酸枣仁: { herb: '酸枣仁', nature: '平', flavors: ['甘', '酸'], effects: ['养心安神', '敛汗'], pricePerGram: 1.2 },
  五味子: { herb: '五味子', nature: '温', flavors: ['酸', '甘'], effects: ['收敛固涩', '益气生津'], pricePerGram: 0.9 },
};

/**
 * 替代候选表：某味药柜里不够时，可从哪些药性相近的药里挑。
 * doseFactor 为替代后的用量系数：>1 需增量，<1 需减量（药力更猛），=1 等量。
 */
export const SUBSTITUTE_TABLE: Record<string, SubstituteSpec[]> = {
  白芍: [{ herb: '赤芍', doseFactor: 1.0 }, { herb: '当归', doseFactor: 1.1 }],
  赤芍: [{ herb: '白芍', doseFactor: 1.0 }, { herb: '丹参', doseFactor: 1.1 }],
  生地: [{ herb: '熟地', doseFactor: 1.0 }, { herb: '知母', doseFactor: 1.0 }],
  熟地: [{ herb: '生地', doseFactor: 1.0 }, { herb: '枸杞', doseFactor: 1.0 }, { herb: '当归', doseFactor: 1.1 }],
  黄芪: [{ herb: '党参', doseFactor: 1.0 }, { herb: '白术', doseFactor: 1.0 }],
  当归: [{ herb: '熟地', doseFactor: 1.0 }, { herb: '白芍', doseFactor: 1.0 }, { herb: '川芎', doseFactor: 1.1 }],
  川芎: [{ herb: '当归', doseFactor: 1.0 }, { herb: '红花', doseFactor: 1.2 }],
  白术: [{ herb: '苍术', doseFactor: 1.0 }, { herb: '党参', doseFactor: 1.0 }, { herb: '茯苓', doseFactor: 1.1 }],
  苍术: [{ herb: '白术', doseFactor: 1.0 }],
  茯苓: [{ herb: '白术', doseFactor: 1.1 }],
  党参: [{ herb: '黄芪', doseFactor: 1.0 }, { herb: '丹参', doseFactor: 1.0 }],
  丹参: [{ herb: '赤芍', doseFactor: 1.1 }, { herb: '川芎', doseFactor: 1.1 }],
  甘草: [{ herb: '党参', doseFactor: 1.1 }],
  桂枝: [{ herb: '柴胡', doseFactor: 1.2 }],
  柴胡: [{ herb: '薄荷', doseFactor: 1.0 }, { herb: '菊花', doseFactor: 1.1 }],
  黄芩: [{ herb: '黄连', doseFactor: 0.8 }, { herb: '黄柏', doseFactor: 1.0 }],
  黄连: [{ herb: '黄芩', doseFactor: 1.2 }, { herb: '黄柏', doseFactor: 1.0 }],
  黄柏: [{ herb: '黄芩', doseFactor: 1.0 }, { herb: '黄连', doseFactor: 0.8 }],
  知母: [{ herb: '生地', doseFactor: 1.0 }, { herb: '黄柏', doseFactor: 1.1 }],
  贝母: [{ herb: '杏仁', doseFactor: 1.1 }, { herb: '半夏', doseFactor: 1.2 }],
  杏仁: [{ herb: '桃仁', doseFactor: 1.0 }, { herb: '贝母', doseFactor: 1.1 }],
  桃仁: [{ herb: '红花', doseFactor: 1.1 }, { herb: '杏仁', doseFactor: 1.0 }],
  红花: [{ herb: '桃仁', doseFactor: 1.0 }, { herb: '川芎', doseFactor: 1.1 }],
  枸杞: [{ herb: '熟地', doseFactor: 1.0 }, { herb: '菊花', doseFactor: 1.1 }],
  菊花: [{ herb: '薄荷', doseFactor: 1.0 }, { herb: '柴胡', doseFactor: 1.1 }],
  薄荷: [{ herb: '菊花', doseFactor: 1.0 }, { herb: '柴胡', doseFactor: 1.0 }],
  陈皮: [{ herb: '青皮', doseFactor: 1.0 }, { herb: '半夏', doseFactor: 1.1 }],
  青皮: [{ herb: '陈皮', doseFactor: 1.0 }, { herb: '柴胡', doseFactor: 1.1 }],
  半夏: [{ herb: '陈皮', doseFactor: 1.1 }, { herb: '贝母', doseFactor: 1.2 }],
  远志: [{ herb: '酸枣仁', doseFactor: 1.0 }, { herb: '五味子', doseFactor: 1.1 }],
  酸枣仁: [{ herb: '远志', doseFactor: 1.0 }, { herb: '五味子', doseFactor: 1.0 }],
  五味子: [{ herb: '酸枣仁', doseFactor: 1.0 }, { herb: '枸杞', doseFactor: 1.1 }],
};

export function getHerbProfile(herb: string): HerbProfile | undefined {
  return HERB_PROFILES[herb];
}

export function getSubstituteSpecs(herb: string): SubstituteSpec[] {
  return SUBSTITUTE_TABLE[herb] ?? [];
}
