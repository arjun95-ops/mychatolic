// Post Composer Component

'use client';

import { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Image as ImageIcon, X } from 'lucide-react';
import { useUIStore } from '@/lib/store/ui-store';
import { useAuth } from '@/lib/features/auth/use-auth';
import { useCreatePost } from '@/lib/features/feed/use-posts';
import { FeedService } from '@/lib/features/feed/feed-service';
import { toast } from 'sonner';
import { useRef } from 'react';

export function PostComposer() {
  const { user, profile } = useAuth();
  const { isCreatePostOpen, closeCreatePost } = useUIStore();
  const { mutateAsync: createPost, isPending } = useCreatePost();
  
  const [caption, setCaption] = useState('');
  const [images, setImages] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const initials = profile?.full_name
    ?.split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'US';

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Validate files (max 5MB per image, max 5 images)
    const validFiles = files.filter(file => {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Ukuran file maksimal 5MB');
        return false;
      }
      if (!file.type.startsWith('image/')) {
        toast.error('Hanya file gambar yang didukung');
        return false;
      }
      return true;
    });

    if (images.length + validFiles.length > 5) {
      toast.error('Maksimal 5 gambar');
      return;
    }

    setImages((prev) => [...prev, ...validFiles]);
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (caption.trim() === '' && images.length === 0) {
      toast.error('Masukkan caption atau pilih gambar');
      return;
    }

    try {
      const imageUrls: string[] = [];
      if (images.length > 0) {
        if (!user?.id) {
          throw new Error('User tidak ditemukan');
        }

        setIsUploading(true);
        for (const file of images) {
          const url = await FeedService.uploadPostImage(user.id, file);
          imageUrls.push(url);
        }
      }

      await createPost({ caption, imageUrls });
      
      // Reset form
      setCaption('');
      setImages([]);
      closeCreatePost();
    } catch (error) {
      console.error('Create post error:', error);
      toast.error(error instanceof Error ? error.message : 'Gagal membuat post');
    } finally {
      setIsUploading(false);
    }
  };

  const isSubmitting = isPending || isUploading;

  if (!isCreatePostOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card className="w-full max-w-lg">
        <CardContent className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold">Buat Postingan</h2>
            <Button variant="ghost" size="icon" onClick={closeCreatePost}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* User Info */}
            <div className="flex items-center gap-3 pb-4 border-b">
              <Avatar>
                <AvatarImage src={profile?.avatar_url} alt={profile?.full_name || ''} />
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-semibold">{profile?.full_name}</p>
                <p className="text-xs text-muted-foreground">
                  {profile?.role}
                </p>
              </div>
            </div>

            {/* Caption Input */}
            <Textarea
              placeholder="Apa yang sedang Anda pikirkan?"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              className="min-h-[120px] resize-none"
              disabled={isSubmitting}
            />

            {/* Image Upload */}
            <div>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageSelect}
                className="hidden"
                disabled={isSubmitting}
              />
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => imageInputRef.current?.click()}
                disabled={isSubmitting}
              >
                <ImageIcon className="mr-2 h-5 w-5" />
                Pilih Gambar
              </Button>
            </div>

            {/* Image Previews */}
            {images.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {images.map((image, index) => (
                  <div key={index} className="relative aspect-square rounded-lg overflow-hidden border">
                    <img
                      src={URL.createObjectURL(image)}
                      alt={`Preview ${index + 1}`}
                      className="h-full w-full object-cover"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute top-1 right-1 h-6 w-6 rounded-full bg-black/50"
                      onClick={() => removeImage(index)}
                      disabled={isSubmitting}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Submit Button */}
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={closeCreatePost}
                disabled={isSubmitting}
              >
                Batal
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-primary hover:bg-primary-hover"
                disabled={isSubmitting || (caption.trim() === '' && images.length === 0)}
              >
                {isSubmitting ? (isUploading ? 'Mengunggah...' : 'Memposting...') : 'Posting'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
