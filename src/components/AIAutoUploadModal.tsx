import React, { useState, useEffect } from 'react';
import { X, Upload, Sparkles, TrendingUp, Image as ImageIcon, CheckCircle, AlertCircle, Loader2, Settings, ThumbsUp, ThumbsDown, AlertTriangle, Info } from 'lucide-react';
import { geminiService, GeminiClothingAnalysis } from '../services/geminiVisionService';
import { imageComparisonService, ComparisonResult, EnhancedSimilarityResult } from '../services/imageComparisonService';
import { collageService } from '../services/collageService';
import { salesHistoryService, ProductSalesData } from '../services/salesHistoryService';
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
  score: ComparisonResult;
  salesLast3Months: number;
  aiReasoning?: string;
}

interface EnhancedSimilarityResultUI extends EnhancedSimilarityResult {
  product: Product;
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
  const [enhancedSimilarityResults, setEnhancedSimilarityResults] = useState<EnhancedSimilarityResultUI[]>([]);
  const [recommendation, setRecommendation] = useState<'auto' | 'manual' | 'not_recommended'>('manual');
  const [comparativeAnalysis, setComparativeAnalysis] = useState<{
    topSimilarities: Array<{
      productName: string;
      similarityScore: number;
      keySimilarities: string[];
      recommendation: string;
      reasoning: string;
    }>;
    overallRecommendation: string;
    marketInsights: string[];
  } | null>(null);
  
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
  
  // Calculate similarity with existing products using Enhanced Algorithm
  const calculateSimilarity = async (analysisResults: AnalysisResult[]) => {
    setAnalysisProgress(60);
    
    if (existingProducts.length === 0) {
      setRecommendation('manual');
      setSimilarityResults([]);
      setEnhancedSimilarityResults([]);
      return;
    }
    
    try {
      console.log('📊 Step 1: Filtering products by sales...');
      
      // STEP 1: Get products with sales > 4pcs (3 months) using new method
      const productsWithGoodSalesData = await salesHistoryService.getProductsWithMinSales(4, 3);
      
      console.log(`✓ Found ${productsWithGoodSalesData.length} products with >4pcs sales (last 3 months)`);
      
      if (productsWithGoodSalesData.length === 0) {
        console.log('⚠️ No products with sufficient sales history');
        setRecommendation('not_recommended');
        setSimilarityResults([]);
        setEnhancedSimilarityResults([]);
        setAnalysisProgress(100);
        return;
      }
      
      // Map sales data to existing products
      const productsWithGoodSales = existingProducts.filter(p =>
        productsWithGoodSalesData.some(sales => sales.productId === p.id)
      );
      
      // Get AI analysis for existing products (or use cached)
      const existingProductsWithAnalysis = await Promise.all(
        productsWithGoodSales.map(async (product) => {
          try {
            // Try to get existing analysis from product data
            if (product.aiAnalysis) {
              return {
                product,
                analysis: product.aiAnalysis as GeminiClothingAnalysis,
                salesData: productsWithGoodSalesData.find(s => s.productId === product.id)!
              };
            }
            
            // If no analysis, analyze main image
            const mainImageUrl = product.images[0] || product.image;
            if (!mainImageUrl) {
              throw new Error(`No image for product ${product.name}`);
            }
            
            // Fetch and analyze image
            const response = await fetch(mainImageUrl);
            const blob = await response.blob();
            const base64 = await collageService.fileToBase64(new File([blob], 'product.jpg'));
            
            const analysis = await geminiService.analyzeClothingImage(base64);
            
            return {
              product,
              analysis,
              salesData: productsWithGoodSalesData.find(s => s.productId === product.id)!
            };
          } catch (error) {
            console.error(`Failed to analyze product ${product.name}:`, error);
            return null;
          }
        })
      );
      
      // Filter out failed analyses
      const validProductsWithAnalysis = existingProductsWithAnalysis.filter(
        (item): item is NonNullable<typeof item> => item !== null
      );
      
      console.log(`✓ Analyzed ${validProductsWithAnalysis.length} existing products`);
      
      if (validProductsWithAnalysis.length === 0) {
        console.log('⚠️ No valid product analyses available');
        setRecommendation('not_recommended');
        setSimilarityResults([]);
        setEnhancedSimilarityResults([]);
        setAnalysisProgress(100);
        return;
      }
      
      setAnalysisProgress(70);
      
      // STEP 2: Calculate enhanced similarity for each product
      console.log('🔍 Step 2: Calculating enhanced similarity scores...');
      
      const uploadedAnalysis = analysisResults[0]?.analysis; // Use first uploaded image analysis
      if (!uploadedAnalysis) {
        throw new Error('No analysis results available for uploaded images');
      }
      
      const enhancedSimilarities: EnhancedSimilarityResultUI[] = [];
      
      for (const item of validProductsWithAnalysis) {
        const enhancedResult = imageComparisonService.calculateEnhancedSimilarity(
          uploadedAnalysis,
          item.analysis,
          {
            totalQuantity: item.salesData.totalQuantity,
            productName: item.product.name
          }
        );
        
        enhancedSimilarities.push({
          ...enhancedResult,
          productId: item.product.id,
          product: item.product
        });
      }
      
      // Sort by overall score (descending)
      enhancedSimilarities.sort((a, b) => b.overallScore - a.overallScore);
      
      setEnhancedSimilarityResults(enhancedSimilarities);
      setAnalysisProgress(80);
      
      // STEP 3: Generate comparative analysis with Gemini
      console.log('🤖 Step 3: Generating comparative analysis...');
      
      try {
        const comparativeAnalysis = await geminiService.generateComparativeAnalysis(
          uploadedAnalysis,
          validProductsWithAnalysis.map(item => ({
            product: item.product,
            analysis: item.analysis,
            salesData: {
              totalQuantity: item.salesData.totalQuantity,
              productName: item.product.name
            }
          })),
          3 // Top 3 products
        );
        
        setComparativeAnalysis(comparativeAnalysis);
        console.log('✓ Comparative analysis generated');
      } catch (error) {
        console.warn('Failed to generate comparative analysis:', error);
        // Continue without comparative analysis
      }
      
      setAnalysisProgress(90);
      
      // STEP 4: Determine overall recommendation
      console.log('📈 Step 4: Determining overall recommendation...');
      
      if (enhancedSimilarities.length === 0) {
        setRecommendation('not_recommended');
      } else {
        const topScore = enhancedSimilarities[0]?.overallScore || 0;
        
        if (topScore >= 80) {
          setRecommendation('auto'); // Highly recommended
        } else if (topScore >= 70) {
          setRecommendation('manual'); // Consider
        } else {
          setRecommendation('not_recommended');
        }
      }
      
      // Keep old similarity results for backward compatibility
      const oldSimilarities: SimilarityResult[] = enhancedSimilarities.map(item => ({
        product: item.product,
        score: {
          overall_similarity: item.overallScore,
          breakdown: {
            model_type: item.breakdown.modelType,
            motif_pattern: item.breakdown.pattern,
            lace_details: 0,
            hem_pleats: 0,
            sleeve_details: 0
          },
          visual_analysis: {
            image1_description: '',
            image2_description: '',
            key_similarities: [],
            key_differences: []
          },
          recommendation: item.recommendationLabel,
          confidence: 0,
          hash_similarity: 0
        },
        salesLast3Months: item.salesLast3Months,
        aiReasoning: item.aiReasoning
      }));
      
      setSimilarityResults(oldSimilarities);
      setAnalysisProgress(100);
      
      console.log('✅ Enhanced similarity analysis complete');
      console.log(`📊 Top similarity: ${enhancedSimilarities[0]?.overallScore || 0}%`);
      console.log(`🏷️ Recommendation: ${recommendation}`);
      
    } catch (error: any) {
      console.error('Error calculating similarity:', error);
      setRecommendation('manual');
      setSimilarityResults([]);
      setEnhancedSimilarityResults([]);
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
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAPISettings(true)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500"
              title="Configure Gemini API Key"
            >
              <Settings className="w-5 h-5" />
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
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
              enhancedSimilarityResults={enhancedSimilarityResults}
              comparativeAnalysis={comparativeAnalysis}
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
  enhancedSimilarityResults?: EnhancedSimilarityResultUI[];
  comparativeAnalysis?: {
    topSimilarities: Array<{
      productName: string;
      similarityScore: number;
      keySimilarities: string[];
      recommendation: string;
      reasoning: string;
    }>;
    overallRecommendation: string;
    marketInsights: string[];
  };
  recommendation: 'auto' | 'manual' | 'not_recommended';
  onBack: () => void;
  onNext: () => void;
}

const ResultsStep: React.FC<ResultsStepProps> = ({
  analysisResults,
  similarityResults,
  enhancedSimilarityResults = [],
  comparativeAnalysis,
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
      
      {/* Enhanced Similarity Results */}
      {enhancedSimilarityResults.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            AI Similarity Analysis (vs Bestsellers &gt;4pcs)
          </h3>
          
          {/* Overall Recommendation */}
          {comparativeAnalysis?.overallRecommendation && (
            <div className="mb-4 p-4 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Sparkles className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-blue-900 mb-1">AI Market Analysis</p>
                  <p className="text-sm text-blue-800">{comparativeAnalysis.overallRecommendation}</p>
                </div>
              </div>
            </div>
          )}
          
          {/* Top Similar Products */}
          <div className="space-y-3">
            {enhancedSimilarityResults.slice(0, 3).map((result, index) => {
              // Determine badge color based on recommendation
              let badgeColor = 'bg-gray-100 text-gray-800';
              let badgeIcon = <Info className="w-4 h-4" />;
              
              if (result.recommendation === 'highly_recommended') {
                badgeColor = 'bg-green-100 text-green-800';
                badgeIcon = <ThumbsUp className="w-4 h-4" />;
              } else if (result.recommendation === 'recommended') {
                badgeColor = 'bg-blue-100 text-blue-800';
                badgeIcon = <ThumbsUp className="w-4 h-4" />;
              } else if (result.recommendation === 'consider') {
                badgeColor = 'bg-yellow-100 text-yellow-800';
                badgeIcon = <AlertTriangle className="w-4 h-4" />;
              } else {
                badgeColor = 'bg-red-100 text-red-800';
                badgeIcon = <ThumbsDown className="w-4 h-4" />;
              }
              
              return (
                <div key={result.productId} className="border border-gray-200 rounded-lg overflow-hidden">
                  {/* Header with score and badge */}
                  <div className="p-4 bg-gray-50 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`px-3 py-1 rounded-full text-xs font-bold ${badgeColor} flex items-center gap-1`}>
                          {badgeIcon}
                          {result.recommendationLabel}
                        </div>
                        <span className="text-sm font-medium text-gray-700">
                          {index + 1}. {result.productName}
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-gray-900">{result.overallScore}%</div>
                        <div className="text-xs text-gray-500">Similarity Score</div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Breakdown and Details */}
                  <div className="p-4">
                    {/* Score Breakdown */}
                    <div className="mb-3">
                      <p className="text-xs font-medium text-gray-500 mb-2">Score Breakdown:</p>
                      <div className="grid grid-cols-5 gap-2">
                        <div className="text-center">
                          <div className="text-sm font-bold text-gray-900">{result.breakdown.modelType}%</div>
                          <div className="text-xs text-gray-500">Model</div>
                        </div>
                        <div className="text-center">
                          <div className="text-sm font-bold text-gray-900">{result.breakdown.pattern}%</div>
                          <div className="text-xs text-gray-500">Pattern</div>
                        </div>
                        <div className="text-center">
                          <div className="text-sm font-bold text-gray-900">{result.breakdown.colors}%</div>
                          <div className="text-xs text-gray-500">Colors</div>
                        </div>
                        <div className="text-center">
                          <div className="text-sm font-bold text-gray-900">{result.breakdown.details}%</div>
                          <div className="text-xs text-gray-500">Details</div>
                        </div>
                        <div className="text-center">
                          <div className="text-sm font-bold text-gray-900">{result.breakdown.embellishments}%</div>
                          <div className="text-xs text-gray-500">Embellish</div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Sales and Reasoning */}
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-xs font-medium text-gray-500 mb-1">AI Reasoning:</p>
                        <p className="text-sm text-gray-700">{result.aiReasoning}</p>
                      </div>
                      <div className="ml-4 text-right">
                        <div className="text-lg font-bold text-green-600">{result.salesLast3Months}</div>
                        <div className="text-xs text-gray-500">Sales (3 months)</div>
                      </div>
                    </div>
                    
                    {/* Recommendation Reason */}
                    <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs font-medium text-gray-500 mb-1">Recommendation:</p>
                      <p className="text-sm text-gray-700">{result.recommendationReason}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          
          {/* Market Insights */}
          {comparativeAnalysis?.marketInsights && comparativeAnalysis.marketInsights.length > 0 && (
            <div className="mt-4 p-4 bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg">
              <h4 className="text-sm font-semibold text-purple-900 mb-2 flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                Market Insights
              </h4>
              <ul className="space-y-1">
                {comparativeAnalysis.marketInsights.map((insight, index) => (
                  <li key={index} className="text-sm text-purple-800 flex items-start gap-2">
                    <span className="text-purple-500 mt-1">•</span>
                    {insight}
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {/* Summary Stats */}
          <div className="mt-4 grid grid-cols-3 gap-4">
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-xs text-blue-600 mb-1">Products Checked</p>
              <p className="text-2xl font-bold text-blue-900">{enhancedSimilarityResults.length}</p>
              <p className="text-xs text-gray-500 mt-1">sales &gt;4pcs</p>
            </div>
            <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
              <p className="text-xs text-purple-600 mb-1">High Match (&gt;80%)</p>
              <p className="text-2xl font-bold text-purple-900">
                {enhancedSimilarityResults.filter(s => s.overallScore > 80).length}
              </p>
              <p className="text-xs text-gray-500 mt-1">strong similarity</p>
            </div>
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-xs text-green-600 mb-1">Total Sales (3mo)</p>
              <p className="text-2xl font-bold text-green-900">
                {enhancedSimilarityResults.reduce((sum, s) => sum + s.salesLast3Months, 0)} pcs
              </p>
              <p className="text-xs text-gray-500 mt-1">from similar items</p>
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
              <p className="text-sm font-semibold text-green-900 mb-1">✅ RECOMMENDED FOR UPLOAD</p>
              <p className="text-xs text-green-800">
                Ditemukan {similarityResults.filter(s => s.score.overall_similarity > 80).length} produk dengan kemiripan motif + model &gt;80%. 
                Produk-produk tersebut memiliki sales history yang bagus ({similarityResults.reduce((sum, s) => sum + s.salesLast3Months, 0)} pcs). 
                Produk baru ini berpotensi laku dengan baik!
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
                Ada produk dengan kemiripan 60-80%, tapi tidak cukup tinggi untuk auto recommendation. 
                Review hasil comparison sebelum upload.
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
              <p className="text-sm font-semibold text-red-900 mb-1">❌ LOW SIMILARITY</p>
              <p className="text-xs text-red-800">
                Tidak ditemukan produk dengan kemiripan motif + model &gt;80%. 
                Ini adalah tipe produk baru yang belum ada di inventory.
              </p>
            </div>
          </div>
        </div>
      )}
      
      {similarityResults.length === 0 && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>💡 Note:</strong> Tidak ada produk dengan sales &gt;4pcs dalam 3 bulan terakhir. 
            Ini adalah produk baru yang belum bisa dibandingkan!
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
