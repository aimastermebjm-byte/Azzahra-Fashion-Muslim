import { GeminiClothingAnalysis } from './geminiVisionService';

export interface SimilarityScore {
  overall: number; // 0-100
  breakdown: {
    model: number;
    motif: number;
    lace: number;
    hem_pleats: number;
    sleeves: number;
    accessories: number;
    color: number;
  };
  matchingFeatures: string[];
  differingFeatures: string[];
}

export interface FeatureWeights {
  model: number;        // 25%
  motif: number;        // 20%
  lace: number;         // 10%
  hem_pleats: number;   // 5%
  sleeves: number;      // 5%
  accessories: number;  // 5%
  color: number;        // 20%
}

export const DEFAULT_WEIGHTS: FeatureWeights = {
  model: 0.35,
  motif: 0.20,
  lace: 0.10,
  hem_pleats: 0.05,
  sleeves: 0.05,
  accessories: 0.05,
  color: 0.20
};

export class SimilarityService {
  calculateSimilarity(
    analysis1: GeminiClothingAnalysis,
    analysis2: GeminiClothingAnalysis,
    weights: FeatureWeights = DEFAULT_WEIGHTS
  ): SimilarityScore {
    const modelScore = this.compareModels(analysis1.clothing_type, analysis2.clothing_type);
    const motifScore = this.comparePatterns(analysis1.pattern_type, analysis2.pattern_type);
    const laceScore = this.compareLace(analysis1.lace_details, analysis2.lace_details);
    const hemScore = this.compareHemPleats(analysis1.hem_pleats, analysis2.hem_pleats);
    const sleeveScore = this.compareSleeves(analysis1.sleeve_details, analysis2.sleeve_details);
    const accessoriesScore = this.compareAccessories(analysis1.embellishments, analysis2.embellishments);
    const colorScore = this.compareColors(analysis1.colors, analysis2.colors);
    
    let overall = (
      modelScore * weights.model +
      motifScore * weights.motif +
      laceScore * weights.lace +
      hemScore * weights.hem_pleats +
      sleeveScore * weights.sleeves +
      accessoriesScore * weights.accessories +
      colorScore * weights.color
    );

    // Strong-match boosters
    const boosterCore = modelScore >= 90 && motifScore >= 80 && colorScore >= 70;
    const boosterShapePattern = modelScore >= 80 && motifScore >= 80 && colorScore >= 60;
    if (boosterCore) {
      overall = Math.max(overall, 95);
    } else if (boosterShapePattern) {
      overall = Math.max(overall, 90);
    }
    
    const matchingFeatures = this.identifyMatches(analysis1, analysis2, {
      model: modelScore,
      motif: motifScore,
      lace: laceScore,
      hem_pleats: hemScore,
      sleeves: sleeveScore,
      accessories: accessoriesScore,
      color: colorScore
    });
    
    const differingFeatures = this.identifyDifferences(analysis1, analysis2, {
      model: modelScore,
      motif: motifScore,
      lace: laceScore,
      hem_pleats: hemScore,
      sleeves: sleeveScore,
      accessories: accessoriesScore,
      color: colorScore
    });
    
    return {
      overall: Math.round(overall),
      breakdown: {
        model: Math.round(modelScore),
        motif: Math.round(motifScore),
        lace: Math.round(laceScore),
        hem_pleats: Math.round(hemScore),
        sleeves: Math.round(sleeveScore),
        accessories: Math.round(accessoriesScore),
        color: Math.round(colorScore)
      },
      matchingFeatures,
      differingFeatures
    };
  }
  
  private compareModels(model1: GeminiClothingAnalysis['clothing_type'], model2: GeminiClothingAnalysis['clothing_type']): number {
    let score = 0;
    
    // Main type (40%)
    if (model1.main_type === model2.main_type) {
      score += 40;
    } else if (this.areSimilarTypes(model1.main_type, model2.main_type)) {
      score += 20; // Partial credit for similar types
    }
    
    // Silhouette (40%)
    if (model1.silhouette === model2.silhouette) {
      score += 40;
    } else if (this.areSimilarSilhouettes(model1.silhouette, model2.silhouette)) {
      score += 25;
    }
    
    // Length (20%)
    if (model1.length === model2.length) {
      score += 20;
    } else {
      const lengthDiff = this.getLengthDifference(model1.length, model2.length);
      score += Math.max(0, 20 - lengthDiff * 5); // Penalize by 5 per step difference
    }
    
    return score;
  }
  
  private areSimilarTypes(type1: string, type2: string): boolean {
    const similarGroups = [
      ['gamis', 'dress'],
      ['tunik', 'blouse'],
    ];
    
    return similarGroups.some(group =>
      group.includes(type1) && group.includes(type2)
    );
  }
  
  private areSimilarSilhouettes(sil1: string, sil2: string): boolean {
    const similarGroups = [
      ['a-line', 'empire'],
      ['loose', 'fitted'],
    ];
    
    return similarGroups.some(group =>
      group.includes(sil1) && group.includes(sil2)
    );
  }
  
  private getLengthDifference(length1: string, length2: string): number {
    const lengthOrder = ['mini', 'hip-length', 'midi', 'maxi'];
    const idx1 = lengthOrder.indexOf(length1);
    const idx2 = lengthOrder.indexOf(length2);
    return Math.abs(idx1 - idx2);
  }
  
  private comparePatterns(pattern1: GeminiClothingAnalysis['pattern_type'], pattern2: GeminiClothingAnalysis['pattern_type']): number {
    let score = 0;
    
    // Pattern type (70%)
    if (pattern1.pattern === pattern2.pattern) {
      score += 70;
    } else if (pattern1.pattern === 'solid' || pattern2.pattern === 'solid') {
      score += 30; // Solid color is somewhat neutral
    } else {
      score += 20; // Different patterns
    }
    
    // Complexity (30%)
    if (pattern1.complexity === pattern2.complexity) {
      score += 30;
    } else {
      const complexityDiff = this.getComplexityDifference(pattern1.complexity, pattern2.complexity);
      score += Math.max(0, 30 - complexityDiff * 10);
    }
    
    return score;
  }
  
  private getComplexityDifference(comp1: string, comp2: string): number {
    const complexityOrder = ['simple', 'detailed', 'ornate'];
    const idx1 = complexityOrder.indexOf(comp1);
    const idx2 = complexityOrder.indexOf(comp2);
    return Math.abs(idx1 - idx2);
  }
  
  private compareLace(lace1: GeminiClothingAnalysis['lace_details'], lace2: GeminiClothingAnalysis['lace_details']): number {
    // If both don't have lace, perfect match
    if (!lace1.has_lace && !lace2.has_lace) return 100;
    
    // If only one has lace, low score
    if (lace1.has_lace !== lace2.has_lace) return 30;
    
    let score = 0;
    const weights = {
      locations: 0.4,    // Where the lace is (40%)
      lace_type: 0.3,    // Type of lace (30%)
      coverage: 0.2,     // How much lace (20%)
      count: 0.1         // Number of lace areas (10%)
    };
    
    // Compare locations
    const locations1 = lace1.locations.map(l => l.position);
    const locations2 = lace2.locations.map(l => l.position);
    const commonLocations = locations1.filter(loc => locations2.includes(loc)).length;
    const maxLocations = Math.max(locations1.length, locations2.length);
    const locationScore = maxLocations > 0 ? (commonLocations / maxLocations) * 100 : 0;
    
    // Compare lace types
    const types1 = lace1.locations.map(l => l.lace_type);
    const types2 = lace2.locations.map(l => l.lace_type);
    const commonTypes = types1.filter(type => types2.includes(type)).length;
    const maxTypes = Math.max(types1.length, types2.length);
    const typeScore = maxTypes > 0 ? (commonTypes / maxTypes) * 100 : 0;
    
    // Compare coverage
    const avgCoverage1 = this.getAverageCoverage(lace1.locations);
    const avgCoverage2 = this.getAverageCoverage(lace2.locations);
    const coverageScore = 100 - Math.abs(avgCoverage1 - avgCoverage2);
    
    // Count similarity
    const countDiff = Math.abs(lace1.locations.length - lace2.locations.length);
    const countScore = Math.max(0, 100 - countDiff * 20);
    
    score = (
      locationScore * weights.locations +
      typeScore * weights.lace_type +
      coverageScore * weights.coverage +
      countScore * weights.count
    );
    
    return score;
  }
  
  private getAverageCoverage(locations: Array<{ coverage: string }>): number {
    if (locations.length === 0) return 0;
    
    const coverageMap: Record<string, number> = { 
      minimal: 20, 
      moderate: 50, 
      extensive: 90 
    };
    
    const sum = locations.reduce((acc, loc) => acc + (coverageMap[loc.coverage] || 0), 0);
    return sum / locations.length;
  }
  
  private compareHemPleats(hem1: GeminiClothingAnalysis['hem_pleats'], hem2: GeminiClothingAnalysis['hem_pleats']): number {
    // If both don't have pleats, perfect match
    if (!hem1.has_pleats && !hem2.has_pleats) return 100;
    
    // If only one has pleats, low score
    if (hem1.has_pleats !== hem2.has_pleats) return 20;
    
    let score = 0;
    
    // Compare pleat type (40%)
    if (hem1.pleat_type === hem2.pleat_type) {
      score += 40;
    } else if (this.areSimilarPleatTypes(hem1.pleat_type, hem2.pleat_type)) {
      score += 25;
    } else {
      score += 10;
    }
    
    // Compare depth (30%)
    const depthMap: Record<string, number> = { shallow: 1, medium: 2, deep: 3 };
    const depthDiff = Math.abs((depthMap[hem1.depth] || 0) - (depthMap[hem2.depth] || 0));
    const depthScore = (3 - depthDiff) / 3 * 30;
    score += depthScore;
    
    // Compare fullness (30%)
    const fullnessDiff = Math.abs(hem1.fullness - hem2.fullness);
    const fullnessScore = Math.max(0, 30 - (fullnessDiff * 0.3));
    score += fullnessScore;
    
    return score;
  }
  
  private areSimilarPleatTypes(type1: string, type2: string): boolean {
    const similarGroups = [
      ['accordion', 'sunray'],
      ['box', 'inverted'],
      ['knife', 'accordion']
    ];
    
    return similarGroups.some(group =>
      group.includes(type1) && group.includes(type2)
    );
  }
  
  private compareSleeves(sleeve1: GeminiClothingAnalysis['sleeve_details'], sleeve2: GeminiClothingAnalysis['sleeve_details']): number {
    // If both don't have pleats/details, check if sleeve types match
    if (!sleeve1.has_pleats && !sleeve2.has_pleats) {
      return sleeve1.sleeve_type === sleeve2.sleeve_type ? 100 : 70;
    }
    
    // If only one has pleats, moderate score based on sleeve type
    if (sleeve1.has_pleats !== sleeve2.has_pleats) {
      return sleeve1.sleeve_type === sleeve2.sleeve_type ? 40 : 20;
    }
    
    let score = 0;
    
    // Compare sleeve type (35%)
    if (sleeve1.sleeve_type === sleeve2.sleeve_type) {
      score += 35;
    } else if (this.areSimilarSleeveTypes(sleeve1.sleeve_type, sleeve2.sleeve_type)) {
      score += 25;
    } else {
      score += 10;
    }
    
    // Compare pleat position (25%)
    if (sleeve1.pleat_position === sleeve2.pleat_position) {
      score += 25;
    } else {
      score += 10;
    }
    
    // Compare ruffle count (15%)
    const ruffleDiff = Math.abs(sleeve1.ruffle_count - sleeve2.ruffle_count);
    const ruffleScore = Math.max(0, 15 - ruffleDiff * 5);
    score += ruffleScore;
    
    // Compare cuff style (15%)
    if (sleeve1.cuff_style === sleeve2.cuff_style) {
      score += 15;
    } else {
      score += 5;
    }
    
    // Remaining 10% for overall similarity
    score += 10;
    
    return score;
  }
  
  private areSimilarSleeveTypes(type1: string, type2: string): boolean {
    const similarGroups = [
      ['puffed', 'bishop', 'lantern'],
      ['bell', 'pleated'],
    ];
    
    return similarGroups.some(group =>
      group.includes(type1) && group.includes(type2)
    );
  }
  
  private compareAccessories(emb1: GeminiClothingAnalysis['embellishments'], emb2: GeminiClothingAnalysis['embellishments']): number {
    let score = 0;
    
    // Beads (30%)
    if (emb1.beads.has === emb2.beads.has) {
      score += 15;
      if (emb1.beads.has && emb2.beads.has) {
        const densityDiff = Math.abs(emb1.beads.density - emb2.beads.density);
        score += Math.max(0, 15 - (densityDiff * 0.15));
      } else {
        score += 15;
      }
    }
    
    // Embroidery (30%)
    if (emb1.embroidery.has === emb2.embroidery.has) {
      score += 30;
    } else {
      score += 10;
    }
    
    // Sequins (20%)
    if (emb1.sequins.has === emb2.sequins.has) {
      score += 20;
    } else {
      score += 5;
    }
    
    // Gold thread (20%)
    if (emb1.gold_thread.has === emb2.gold_thread.has) {
      score += 10;
      if (emb1.gold_thread.has && emb2.gold_thread.has) {
        const coverageDiff = Math.abs(emb1.gold_thread.coverage - emb2.gold_thread.coverage);
        score += Math.max(0, 10 - (coverageDiff * 0.1));
      } else {
        score += 10;
      }
    }
    
    return score;
  }
  
  private compareColors(colors1: string[], colors2: string[]): number {
    if (colors1.length === 0 || colors2.length === 0) return 50;
    
    const norm = (arr: string[]) => arr.map(c => c.toLowerCase());
    const a = norm(colors1);
    const b = norm(colors2);

    const common = a.filter(c => b.includes(c)).length;
    const union = new Set([...a, ...b]).size;
    const overlap = union > 0 ? (common / union) * 100 : 0;

    // Emphasize dominant color match: if at least 2 colors and 80% overlap, treat as perfect
    if (overlap >= 80) return 100;

    return overlap;
  }
  
  private identifyMatches(
    analysis1: GeminiClothingAnalysis, 
    analysis2: GeminiClothingAnalysis,
    scores: Record<string, number>
  ): string[] {
    const matches: string[] = [];
    
    if (scores.model >= 70) {
      matches.push(`Model: ${analysis1.clothing_type.main_type} (match)`);
    }
    
    if (scores.motif >= 70) {
      matches.push(`Motif: ${analysis1.pattern_type.pattern} (match)`);
    }
    
    if (scores.lace >= 70 && analysis1.lace_details.has_lace) {
      matches.push(`Lace details (similar locations)`);
    }
    
    if (scores.hem_pleats >= 70 && analysis1.hem_pleats.has_pleats) {
      matches.push(`Hem pleats: ${analysis1.hem_pleats.pleat_type} (match)`);
    }
    
    if (scores.sleeves >= 70) {
      matches.push(`Sleeve style: ${analysis1.sleeve_details.sleeve_type} (match)`);
    }
    
    if (scores.accessories >= 70) {
      matches.push('Embellishments (similar)');
    }
    
    if (scores.color >= 70) {
      matches.push(`Colors: ${analysis1.colors.join(', ')} (similar)`);
    }
    
    return matches;
  }
  
  private identifyDifferences(
    analysis1: GeminiClothingAnalysis, 
    analysis2: GeminiClothingAnalysis,
    scores: Record<string, number>
  ): string[] {
    const differences: string[] = [];
    
    if (scores.model < 50) {
      differences.push(`Model: ${analysis1.clothing_type.main_type} vs ${analysis2.clothing_type.main_type}`);
    }
    
    if (scores.motif < 50) {
      differences.push(`Motif: ${analysis1.pattern_type.pattern} vs ${analysis2.pattern_type.pattern}`);
    }
    
    if (scores.lace < 50) {
      if (analysis1.lace_details.has_lace !== analysis2.lace_details.has_lace) {
        differences.push(`Lace: one has lace, other doesn't`);
      } else {
        differences.push(`Lace details differ`);
      }
    }
    
    if (scores.hem_pleats < 50) {
      if (analysis1.hem_pleats.has_pleats !== analysis2.hem_pleats.has_pleats) {
        differences.push(`Hem pleats: one has pleats, other doesn't`);
      } else {
        differences.push(`Hem pleat style differs`);
      }
    }
    
    if (scores.sleeves < 50) {
      differences.push(`Sleeve style: ${analysis1.sleeve_details.sleeve_type} vs ${analysis2.sleeve_details.sleeve_type}`);
    }
    
    if (scores.color < 50) {
      differences.push(`Colors differ: ${analysis1.colors.join(', ')} vs ${analysis2.colors.join(', ')}`);
    }
    
    return differences;
  }
}

export const similarityService = new SimilarityService();
