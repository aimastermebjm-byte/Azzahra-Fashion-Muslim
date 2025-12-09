import React, { useState, useEffect } from 'react';
import { X, Upload, Sparkles, TrendingUp, Image as ImageIcon, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { geminiService, GeminiClothingAnalysis } from '../services/geminiVisionService';
import { similarityService, SimilarityScore } from '../services/similarityService';
import { collageService } from '../services/collageService';
import { salesHistoryService, ProductSalesData } from '../services/salesHistoryService';
import { productAnalysisService } from '../services/productAnalysisService';
import { hasGeminiAPIKey, loadGeminiAPIKey } from '../utils/encryption';
import GeminiAPISettings from './GeminiAPISettings';
import { Product } from '../types';

interface AIAutoUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (productData: any) => void;
  existingProducts: Product[]; // For similarity comparison
}

type Step = 'upload' | 'analyzing' | 'results' | 'collage';

interface AnalysisResult {
  imageIndex: number;
  fileName: string;
  analysis: GeminiClothingAnalysis;
  processingTime: number;
}

interface SimilarityResult {
  product: Product;
  score: SimilarityScore;
  salesLast3Months: number;
}

export const AIAutoUploadModal: React.FC<AIAutoUploadModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  existingProducts
}) => {
  // Step management
  const [step, setStep] = useState<Step>('upload');
  
  // Upload step
  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState(false);
  
  // Analysis step
  const [analysisResults, setAnalysisResults] = useState<AnalysisResult[]>([]);
  const [analyzingIndex, setAnalyzingIndex] = useState(0);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  
  // Results step
  const [similarityResults, setSimilarityResults] = useState<SimilarityResult[]>([]);
  const [recommendation, setRecommendation] = useState<'auto' | 'manual' | 'not_recommended'>('manual');
  
  // Collage step
  const [collageBlob, setCollageBlob] = useState<Blob | null>(null);
  const [collagePreview, setCollagePreview] = useState<string | null>(null);
  const [variantLabels, setVariantLabels] = useState<string[]>([]);
  const [productFormData, setProductFormData] = useState({
    name: '',
    retailPrice: '',
    resellerPrice: '',
    category: 'Gamis',
    stockPerVariant: '10'
  });
  
  // Check API key on mount
  const [hasAPIKey, setHasAPIKey] = useState(false);
  const [showAPISettings, setShowAPISettings] = useState(false);
  
  useEffect(() => {
    if (isOpen) {
      const apiKeyExists = hasGeminiAPIKey();
      setHasAPIKey(apiKeyExists);
      
      if (apiKeyExists) {
        // Initialize Gemini service
        const apiKey = loadGeminiAPIKey();
        if (apiKey) {
          try {
            geminiService.initialize(apiKey);
          } catch (error) {
            console.error('Failed to initialize Gemini:', error);
          }
        }
      } else {
        setShowAPISettings(true);
      }
    }
  }, [isOpen]);
  
  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setStep('upload');
      setImages([]);
      setImagePreviews([]);
      setAnalysisResults([]);
      setSimilarityResults([]);
      setCollageBlob(null);
      setCollagePreview(null);
      setAnalysisError(null);
      setRecommendation('manual');
      setProductFormData({
        name: '',
        retailPrice: '',
        resellerPrice: '',
        category: 'Gamis',
        stockPerVariant: '10'
      });
    }
  }, [isOpen]);
  
  // Handle image upload
  const handleFileSelect = (files: FileList | null) => {
    if (!files) return;
    
    const selectedFiles = Array.from(files).slice(0, 9); // Max 9 images
    const validFiles: File[] = [];
    const previews: string[] = [];
    
    selectedFiles.forEach(file => {
      if (file.type.startsWith('image/')) {
        validFiles.push(file);
        previews.push(URL.createObjectURL(file));
      }
    });
    
    // Add to existing images (max 9 total)
    const totalImages = [...images, ...validFiles].slice(0, 9);
    const totalPreviews = [...imagePreviews, ...previews].slice(0, 9);
    
    setImages(totalImages);
    setImagePreviews(totalPreviews);
    
    // Generate variant labels
    const labels = collageService.generateVariantLabels(totalImages.length);
    setVariantLabels(labels);
  };
  
  const removeImage = (index: number) => {
    const newImages = images.filter((_, i) => i !== index);
    const newPreviews = imagePreviews.filter((_, i) => i !== index);
    
    // Revoke object URL
    URL.revokeObjectURL(imagePreviews[index]);
    
    setImages(newImages);
    setImagePreviews(newPreviews);
    
    // Update labels
    const labels = collageService.generateVariantLabels(newImages.length);
    setVariantLabels(labels);
  };
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFileSelect(e.dataTransfer.files);
  };
  
  // Start analysis
  const startAnalysis = async () => {
    if (images.length < 3) {
      alert('Please upload at least 3 images');
      return;
    }
    
    if (!geminiService.isInitialized()) {
      alert('Gemini API not initialized. Please configure API key first.');
      return;
    }
    
    setStep('analyzing');
    setAnalysisError(null);
    setAnalysisProgress(0);
    
    try {
      // Convert images to base64
      const base64Images = await Promise.all(
        images.map(img => collageService.fileToBase64(img))
      );
      
      // Analyze each image
      const results: AnalysisResult[] = [];
      
      for (let i = 0; i < base64Images.length; i++) {
        setAnalyzingIndex(i);
        const startTime = Date.now();
        
        try {
          const analysis = await geminiService.analyzeClothingImage(base64Images[i]);
          const endTime = Date.now();
          
          results.push({
            imageIndex: i,
            fileName: images[i].name,
            analysis,
            processingTime: endTime - startTime
          });
          
          setAnalysisProgress(((i + 1) / images.length) * 50); // 50% for analysis
        } catch (error: any) {
          console.error(`Analysis failed for image ${i}:`, error);
          throw new Error(`Failed to analyze image ${i + 1}: ${error.message}`);
        }
      }
      
      setAnalysisResults(results);
      
      // Calculate similarity with existing products
      await calculateSimilarity(results);
      
      setAnalysisProgress(100);
      setStep('results');
      
    } catch (error: any) {
      console.error('Analysis error:', error);
      setAnalysisError(error.message || 'Analysis failed. Please try again.');
    }
  };
  
  // Calculate similarity with existing products
  const calculateSimilarity = async (analysisResults: AnalysisResult[]) => {
    setAnalysisProgress(60);
    
    if (existingProducts.length === 0) {
      setRecommendation('manual');
      setSimilarityResults([]);
      return;
    }
    
    try {
      // Use first image analysis as primary reference
      const primaryAnalysis = analysisResults[0]?.analysis;
      
      if (!primaryAnalysis) {
        setRecommendation('manual');
        return;
      }
      
      console.log('🔍 Calculating AI-powered similarity with', existingProducts.length, 'products...');
      console.log('📊 Primary analysis:', primaryAnalysis);
      
      // Get all product IDs
      const productIds = existingProducts.map(p => p.id);
      
      // Query sales data for all products (last 3 months)
      console.log('💰 Querying sales data for 3 months...');
      const salesData = await salesHistoryService.getBatchProductSales(productIds, 3);
      
      setAnalysisProgress(65);
      
    // Helper: normalize stored analysis
    const normalizeStoredAnalysis = (analysis: any): GeminiClothingAnalysis => ({
      clothing_type: {
        main_type: analysis.clothing_type.main_type as any,
        silhouette: analysis.clothing_type.silhouette as any,
        length: analysis.clothing_type.length as any,
        confidence: analysis.clothing_type.confidence
      },
      pattern_type: {
        pattern: analysis.pattern_type.pattern as any,
        complexity: analysis.pattern_type.complexity as any,
        confidence: analysis.pattern_type.confidence
      },
      lace_details: {
        has_lace: analysis.lace_details.has_lace,
        locations: analysis.lace_details.locations as any,
        confidence: analysis.lace_details.confidence
      },
      hem_pleats: {
        has_pleats: analysis.hem_pleats.has_pleats,
        pleat_type: analysis.hem_pleats.pleat_type as any,
        depth: analysis.hem_pleats.depth as any,
        fullness: analysis.hem_pleats.fullness,
        confidence: analysis.hem_pleats.confidence
      },
      sleeve_details: {
        has_pleats: analysis.sleeve_details.has_pleats,
        sleeve_type: analysis.sleeve_details.sleeve_type as any,
        pleat_position: analysis.sleeve_details.pleat_position as any,
        ruffle_count: analysis.sleeve_details.ruffle_count,
        cuff_style: analysis.sleeve_details.cuff_style as any,
        confidence: analysis.sleeve_details.confidence
      },
      embellishments: analysis.embellishments,
      colors: analysis.colors,
      fabric_texture: analysis.fabric_texture as any
    });

    const fetchImageAsBase64 = async (url: string): Promise<string> => {
      const response = await fetch(url);
      const blob = await response.blob();
      return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1] || '');
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    };

    const getOrAnalyzeProduct = async (product: Product): Promise<GeminiClothingAnalysis | null> => {
      if (product.aiAnalysis?.clothing_type) {
        return normalizeStoredAnalysis(product.aiAnalysis);
      }

      const imageUrl = product.images?.[0] || product.image;
      if (!imageUrl) {
        console.log(`⏭️ Skipping ${product.name} - no image available for AI analysis`);
        return null;
      }

      try {
        console.log(`🤖 Auto-analyzing product (no cached AI): ${product.name}`);
        const base64 = await fetchImageAsBase64(imageUrl);
        const analysis = await geminiService.analyzeClothingImage(base64);
        return analysis;
      } catch (err) {
        console.error(`❌ Failed auto-analysis for ${product.name}:`, err);
        return null;
      }
    };

    setAnalysisProgress(75);
    const similarities: SimilarityResult[] = [];
    
    for (const product of existingProducts) {
      const productSales = salesData.get(product.id);
      if (!productSales) continue;

      const existingAnalysis = await getOrAnalyzeProduct(product);
      if (!existingAnalysis) {
        console.log(`⏭️ Skipping ${product.name} - AI analysis unavailable`);
        continue;
      }

      console.log(`✨ Using AI analysis for ${product.name}`);

      const similarityScore = similarityService.calculateSimilarity(
        primaryAnalysis,
        existingAnalysis
      );
      
      console.log(`📊 AI Similarity for ${product.name}: ${similarityScore.overall}%`);
      
      similarities.push({
        product,
        score: similarityScore,
        salesLast3Months: productSales.totalQuantity
      });
    }
      
      // Sort by overall similarity first, then by sales
      similarities.sort((a, b) => {
        const scoreDiff = b.score.overall - a.score.overall;
        if (Math.abs(scoreDiff) > 5) return scoreDiff; // If score diff > 5%, sort by score
        return b.salesLast3Months - a.salesLast3Months; // Otherwise sort by sales
      });
      
      // Keep top 10
      const topSimilarities = similarities.slice(0, 10);
      
      setSimilarityResults(topSimilarities);
      
      console.log('📈 Top similar products:', topSimilarities);
      
      setAnalysisProgress(90);
      
      // Calculate recommendation
      const totalSales = topSimilarities.reduce((sum, s) => sum + s.salesLast3Months, 0);
      const avgSimilarity = topSimilarities.length > 0
        ? topSimilarities.reduce((sum, s) => sum + s.score.overall, 0) / topSimilarities.length
        : 0;
      
      console.log('📊 Total sales:', totalSales, 'pcs');
      console.log('📊 Avg similarity (AI-powered):', avgSimilarity.toFixed(1), '%');
      
      // Auto-upload criteria:
      // 1. Average similarity >= 80%
      // 2. Total sales of similar products >= 4 pcs
      if (avgSimilarity >= 80 && totalSales >= 4) {
        setRecommendation('auto');
        console.log('✅ RECOMMENDED: Auto upload (High AI similarity + Good sales)');
      } else if (avgSimilarity >= 60 && totalSales >= 2) {
        setRecommendation('manual');
        console.log('⚠️ MANUAL REVIEW: Moderate similarity or sales');
      } else {
        setRecommendation('not_recommended');
        console.log('❌ NOT RECOMMENDED: Low similarity or no sales history');
      }
      
    } catch (error: any) {
      console.error('Error calculating similarity:', error);
      setRecommendation('manual');
      setSimilarityResults([]);
    }
  };
  
  // Generate collage
  const generateCollagePreview = async () => {
    try {
      const blob = await collageService.generateCollage(images, variantLabels);
      setCollageBlob(blob);
      
      const previewUrl = URL.createObjectURL(blob);
      setCollagePreview(previewUrl);
      
      setStep('collage');
    } catch (error: any) {
      console.error('Collage generation error:', error);
      alert('Failed to generate collage. Please try again.');
    }
  };
  
  // Submit product
  const handleSubmit = () => {
    if (!productFormData.name || !productFormData.retailPrice || !productFormData.resellerPrice) {
      alert('Please fill in all required fields');
      return;
    }
    
    if (!collageBlob) {
      alert('Collage not generated');
      return;
    }
    
    // Create product data with collage
    const productData = {
      ...productFormData,
      collageBlob,
      collageFile: new File([collageBlob], `collage-${Date.now()}.jpg`, { type: 'image/jpeg' }),
      variantLabels,
      analysisResults,
      similarityResults,
      variantCount: images.length
    };
    
    onSuccess(productData);
  };
  
  if (!isOpen) return null;
  
  // API Settings Screen
  if (showAPISettings) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
            <h2 className="text-xl font-bold text-gray-900">Configure Gemini API</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="p-6">
            <GeminiAPISettings
              onSave={() => {
                setHasAPIKey(true);
                setShowAPISettings(false);
              }}
              onClose={() => setShowAPISettings(false)}
            />
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">🤖 AI Auto Upload</h2>
              <p className="text-sm text-gray-500">
                Upload 3-9 variant images for AI analysis
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Progress Steps */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between max-w-2xl mx-auto">
            {[
              { id: 'upload', label: 'Upload', icon: Upload },
              { id: 'analyzing', label: 'Analyzing', icon: Sparkles },
              { id: 'results', label: 'Results', icon: TrendingUp },
              { id: 'collage', label: 'Collage', icon: ImageIcon }
            ].map((s, index) => {
              const isActive = step === s.id;
              const isCompleted = ['upload', 'analyzing', 'results', 'collage'].indexOf(step) > index;
              const Icon = s.icon;
              
              return (
                <React.Fragment key={s.id}>
                  <div className="flex flex-col items-center">
                    <div
                      className={`
                        w-10 h-10 rounded-full flex items-center justify-center mb-1 transition-all
                        ${isActive ? 'bg-purple-600 text-white shadow-lg' : ''}
                        ${isCompleted ? 'bg-green-600 text-white' : ''}
                        ${!isActive && !isCompleted ? 'bg-gray-200 text-gray-400' : ''}
                      `}
                    >
                      {isCompleted ? <CheckCircle className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                    </div>
                    <span
                      className={`
                        text-xs font-medium
                        ${isActive ? 'text-purple-600' : ''}
                        ${isCompleted ? 'text-green-600' : ''}
                        ${!isActive && !isCompleted ? 'text-gray-400' : ''}
                      `}
                    >
                      {s.label}
                    </span>
                  </div>
                  {index < 3 && (
                    <div
                      className={`
                        flex-1 h-1 mx-2 rounded-full transition-all
                        ${isCompleted ? 'bg-green-600' : 'bg-gray-200'}
                      `}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
        
        {/* Content */}
        <div className="p-6">
          {/* STEP 1: Upload Images */}
          {step === 'upload' && (
            <UploadStep
              images={images}
              imagePreviews={imagePreviews}
              variantLabels={variantLabels}
              dragOver={dragOver}
              onFileSelect={handleFileSelect}
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onRemoveImage={removeImage}
              onNext={startAnalysis}
              onCancel={onClose}
            />
          )}
          
          {/* STEP 2: Analyzing */}
          {step === 'analyzing' && (
            <AnalyzingStep
              images={images}
              analyzingIndex={analyzingIndex}
              analysisProgress={analysisProgress}
              analysisError={analysisError}
            />
          )}
          
          {/* STEP 3: Results */}
          {step === 'results' && (
            <ResultsStep
              analysisResults={analysisResults}
              similarityResults={similarityResults}
              recommendation={recommendation}
              onBack={() => setStep('upload')}
              onNext={generateCollagePreview}
            />
          )}
          
          {/* STEP 4: Collage & Submit */}
          {step === 'collage' && (
            <CollageStep
              collagePreview={collagePreview}
              variantLabels={variantLabels}
              variantCount={images.length}
              formData={productFormData}
              onFormChange={setProductFormData}
              onBack={() => setStep('results')}
              onSubmit={handleSubmit}
            />
          )}
        </div>
      </div>
    </div>
  );
};

// Step Components (separate for clarity)

interface UploadStepProps {
  images: File[];
  imagePreviews: string[];
  variantLabels: string[];
  dragOver: boolean;
  onFileSelect: (files: FileList | null) => void;
  onDrop: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onRemoveImage: (index: number) => void;
  onNext: () => void;
  onCancel: () => void;
}

const UploadStep: React.FC<UploadStepProps> = ({
  images,
  imagePreviews,
  variantLabels,
  dragOver,
  onFileSelect,
  onDrop,
  onDragOver,
  onDragLeave,
  onRemoveImage,
  onNext,
  onCancel
}) => {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Upload Variant Images</h3>
        <p className="text-sm text-gray-600">
          Upload 3-9 images of different variants. AI will analyze patterns, lace details, pleats, and more.
        </p>
      </div>
      
      {/* Drop Zone */}
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center transition-all
          ${dragOver ? 'border-purple-500 bg-purple-50' : 'border-gray-300 hover:border-gray-400'}
        `}
      >
        <input
          type="file"
          id="image-upload"
          multiple
          accept="image/*"
          onChange={(e) => onFileSelect(e.target.files)}
          className="hidden"
        />
        <label
          htmlFor="image-upload"
          className="cursor-pointer"
        >
          <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-700 font-medium mb-1">
            Click to upload or drag and drop
          </p>
          <p className="text-sm text-gray-500">
            PNG, JPG up to 5MB each (3-9 images)
          </p>
        </label>
      </div>
      
      {/* Image Previews */}
      {images.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-gray-700">
              {images.length} image{images.length !== 1 ? 's' : ''} selected
            </p>
            <p className="text-xs text-gray-500">
              {images.length < 3 && `Need ${3 - images.length} more`}
              {images.length >= 3 && images.length < 9 && `Can add ${9 - images.length} more`}
              {images.length === 9 && 'Maximum reached'}
            </p>
          </div>
          
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
            {imagePreviews.map((preview, index) => (
              <div key={index} className="relative group">
                <div className="aspect-square rounded-lg overflow-hidden border-2 border-gray-200">
                  <img
                    src={preview}
                    alt={`Variant ${variantLabels[index]}`}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="absolute top-1 left-1 px-2 py-1 bg-black/75 text-white text-xs font-bold rounded">
                  {variantLabels[index]}
                </div>
                <button
                  onClick={() => onRemoveImage(index)}
                  className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Actions */}
      <div className="flex gap-3 justify-end">
        <button
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-all"
        >
          Cancel
        </button>
        <button
          onClick={onNext}
          disabled={images.length < 3}
          className={`
            px-6 py-2 rounded-lg font-medium transition-all flex items-center gap-2
            ${images.length >= 3
              ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700 shadow-lg'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }
          `}
        >
          <Sparkles className="w-4 h-4" />
          Analyze with AI
        </button>
      </div>
    </div>
  );
};

interface AnalyzingStepProps {
  images: File[];
  analyzingIndex: number;
  analysisProgress: number;
  analysisError: string | null;
}

const AnalyzingStep: React.FC<AnalyzingStepProps> = ({
  images,
  analyzingIndex,
  analysisProgress,
  analysisError
}) => {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="inline-flex p-4 bg-purple-100 rounded-full mb-4">
          <Loader2 className="w-12 h-12 text-purple-600 animate-spin" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Analyzing with Gemini AI...
        </h3>
        <p className="text-sm text-gray-600">
          Detecting model, patterns, lace, pleats, and embellishments
        </p>
      </div>
      
      {/* Progress Bar */}
      <div>
        <div className="flex justify-between text-sm text-gray-600 mb-2">
          <span>Progress</span>
          <span>{Math.round(analysisProgress)}%</span>
        </div>
        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-purple-600 to-blue-600 transition-all duration-300"
            style={{ width: `${analysisProgress}%` }}
          />
        </div>
      </div>
      
      {/* Image Analysis Status */}
      <div className="space-y-2">
        {images.map((img, index) => {
          const isAnalyzing = index === analyzingIndex;
          const isCompleted = index < analyzingIndex;
          const isPending = index > analyzingIndex;
          
          return (
            <div
              key={index}
              className={`
                flex items-center gap-3 p-3 rounded-lg border
                ${isAnalyzing ? 'border-purple-300 bg-purple-50' : ''}
                ${isCompleted ? 'border-green-300 bg-green-50' : ''}
                ${isPending ? 'border-gray-200 bg-gray-50' : ''}
              `}
            >
              <div>
                {isCompleted && <CheckCircle className="w-5 h-5 text-green-600" />}
                {isAnalyzing && <Loader2 className="w-5 h-5 text-purple-600 animate-spin" />}
                {isPending && <div className="w-5 h-5 rounded-full border-2 border-gray-300" />}
              </div>
              <span className="flex-1 text-sm font-medium text-gray-700">
                Image {index + 1} - {img.name}
              </span>
              {isCompleted && <span className="text-xs text-green-600">✓ Analyzed</span>}
              {isAnalyzing && <span className="text-xs text-purple-600">Analyzing...</span>}
              {isPending && <span className="text-xs text-gray-400">Waiting...</span>}
            </div>
          );
        })}
      </div>
      
      {/* Error */}
      {analysisError && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-900 mb-1">Analysis Error</p>
            <p className="text-sm text-red-800">{analysisError}</p>
          </div>
        </div>
      )}
    </div>
  );
};

interface ResultsStepProps {
  analysisResults: AnalysisResult[];
  similarityResults: SimilarityResult[];
  recommendation: 'auto' | 'manual' | 'not_recommended';
  onBack: () => void;
  onNext: () => void;
}

const ResultsStep: React.FC<ResultsStepProps> = ({
  analysisResults,
  similarityResults,
  recommendation,
  onBack,
  onNext
}) => {
  // Calculate totals
  const totalSales = similarityResults.reduce((sum, s) => sum + s.salesLast3Months, 0);
  const avgSimilarity = similarityResults.length > 0
    ? similarityResults.reduce((sum, s) => sum + s.score.overall, 0) / similarityResults.length
    : 0;
  
  return (
    <div className="space-y-6">
      {/* Success Message */}
      <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
        <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-medium text-green-900 mb-1">Analysis Complete!</p>
          <p className="text-sm text-green-800">
            Successfully analyzed {analysisResults.length} images. Compared with {similarityResults.length} similar products.
          </p>
        </div>
      </div>
      
      {/* Analysis Summary */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Analysis Summary</h3>
        <div className="space-y-3">
          {analysisResults.map((result, index) => {
            const analysis = result.analysis;
            return (
              <div key={index} className="p-4 border border-gray-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <div className="px-3 py-1 bg-purple-100 text-purple-700 text-xs font-bold rounded">
                    {String.fromCharCode(65 + index)}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900 mb-2">
                      {result.fileName}
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-gray-500">Type:</span>{' '}
                        <span className="font-medium">{analysis.clothing_type.main_type}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Pattern:</span>{' '}
                        <span className="font-medium">{analysis.pattern_type.pattern}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Lace:</span>{' '}
                        <span className="font-medium">{analysis.lace_details.has_lace ? 'Yes' : 'No'}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Hem Pleats:</span>{' '}
                        <span className="font-medium">{analysis.hem_pleats.has_pleats ? 'Yes' : 'No'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500">
                    {(result.processingTime / 1000).toFixed(1)}s
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Similarity Results */}
      {similarityResults.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3">📊 Similar Products (Last 3 Months)</h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {similarityResults.slice(0, 5).map((result, index) => (
              <div key={result.product.id} className="p-3 border border-gray-200 rounded-lg bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      {index + 1}. {result.product.name}
                    </p>
                    <div className="flex items-center gap-4 mt-1">
                      <span className="text-xs text-gray-600">
                        Category: {result.product.category}
                      </span>
                      <span className="text-xs text-gray-600">
                        Similarity: {result.score.overall}%
                      </span>
                      <span className="text-xs font-semibold text-green-600">
                        Sales: {result.salesLast3Months} pcs
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {/* Summary Stats */}
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-xs text-blue-600 mb-1">Average Similarity</p>
              <p className="text-2xl font-bold text-blue-900">{avgSimilarity.toFixed(1)}%</p>
            </div>
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-xs text-green-600 mb-1">Total Sales (3 months)</p>
              <p className="text-2xl font-bold text-green-900">{totalSales} pcs</p>
            </div>
          </div>
        </div>
      )}
      
      {/* Recommendation */}
      {recommendation === 'auto' && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-green-900 mb-1">✅ HIGHLY RECOMMENDED FOR AUTO UPLOAD</p>
              <p className="text-xs text-green-800">
                Similar products sold well ({totalSales} pcs) with high similarity ({avgSimilarity.toFixed(1)}%). 
                This product has strong potential!
              </p>
            </div>
          </div>
        </div>
      )}
      
      {recommendation === 'manual' && (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-yellow-900 mb-1">⚠️ MANUAL REVIEW RECOMMENDED</p>
              <p className="text-xs text-yellow-800">
                Moderate similarity or sales. Review the analysis before uploading.
              </p>
            </div>
          </div>
        </div>
      )}
      
      {recommendation === 'not_recommended' && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-red-900 mb-1">❌ LOW CONFIDENCE</p>
              <p className="text-xs text-red-800">
                Low similarity or no sales history for similar products. Consider carefully before uploading.
              </p>
            </div>
          </div>
        </div>
      )}
      
      {similarityResults.length === 0 && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>💡 Note:</strong> No similar products found in sales history. This is a new type of product!
          </p>
        </div>
      )}
      
      {/* Actions */}
      <div className="flex gap-3 justify-end">
        <button
          onClick={onBack}
          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-all"
        >
          Back
        </button>
        <button
          onClick={onNext}
          className="px-6 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-medium hover:from-purple-700 hover:to-blue-700 shadow-lg transition-all flex items-center gap-2"
        >
          <ImageIcon className="w-4 h-4" />
          Generate Collage
        </button>
      </div>
    </div>
  );
};

interface CollageStepProps {
  collagePreview: string | null;
  variantLabels: string[];
  variantCount: number;
  formData: any;
  onFormChange: (data: any) => void;
  onBack: () => void;
  onSubmit: () => void;
}

const CollageStep: React.FC<CollageStepProps> = ({
  collagePreview,
  variantLabels,
  variantCount,
  formData,
  onFormChange,
  onBack,
  onSubmit
}) => {
  const layout = collageService.getOptimalLayout(variantCount);
  const dimensions = collageService.getCollageDimensions(variantCount);
  
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Collage Preview</h3>
        <p className="text-sm text-gray-600">
          Review the collage and fill in product details to complete the upload.
        </p>
      </div>
      
      {/* Collage Preview */}
      {collagePreview && (
        <div className="border-2 border-gray-200 rounded-lg overflow-hidden">
          <img
            src={collagePreview}
            alt="Product Collage"
            className="w-full"
          />
          <div className="p-3 bg-gray-50 border-t border-gray-200">
            <div className="flex items-center justify-between text-xs text-gray-600">
              <span>Layout: {layout.rows}×{layout.cols} grid</span>
              <span>{dimensions.width}×{dimensions.height}px</span>
              <span>{variantCount} variants ({variantLabels.join(', ')})</span>
            </div>
          </div>
        </div>
      )}
      
      {/* Product Form */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Product Name *
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => onFormChange({ ...formData, name: e.target.value })}
            placeholder={`Gamis Varian Premium ${variantLabels.join('-')}`}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Retail Price *
            </label>
            <input
              type="number"
              value={formData.retailPrice}
              onChange={(e) => onFormChange({ ...formData, retailPrice: e.target.value })}
              placeholder="150000"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reseller Price *
            </label>
            <input
              type="number"
              value={formData.resellerPrice}
              onChange={(e) => onFormChange({ ...formData, resellerPrice: e.target.value })}
              placeholder="135000"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category
            </label>
            <select
              value={formData.category}
              onChange={(e) => onFormChange({ ...formData, category: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="Gamis">Gamis</option>
              <option value="Tunik">Tunik</option>
              <option value="Dress">Dress</option>
              <option value="Hijab">Hijab</option>
              <option value="Khimar">Khimar</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Stock per Variant
            </label>
            <input
              type="number"
              value={formData.stockPerVariant}
              onChange={(e) => onFormChange({ ...formData, stockPerVariant: e.target.value })}
              placeholder="10"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>
      
      {/* Actions */}
      <div className="flex gap-3 justify-end">
        <button
          onClick={onBack}
          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-all"
        >
          Back
        </button>
        <button
          onClick={onSubmit}
          className="px-6 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-medium hover:from-purple-700 hover:to-blue-700 shadow-lg transition-all flex items-center gap-2"
        >
          <Upload className="w-4 h-4" />
          Upload Product
        </button>
      </div>
    </div>
  );
};

export default AIAutoUploadModal;
