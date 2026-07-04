'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Loader2, Star, UploadCloud, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { cn } from '@/lib/cn';
import { api } from '@/lib/api';
import { cloudinaryThumb } from '@/lib/cloudinary';
import { ACCEPTED_IMAGE_ACCEPT, validateImageFile } from '@/lib/image-upload';
import { uploadToCloudinary } from '@/lib/cloudinary-upload';
import { FormSection } from '../form-section';
import { orderedInsertIndex } from '../product-images';
import { useUploadStatus } from '../upload-status';
import type { ProductFormValues, ProductImageInput } from '../product-form-schema';

const MAX_IMAGES = 12;

/** An in-flight upload — local component state, promoted into the form on success. */
interface Uploading {
  id: string;
  fileName: string;
  previewUrl: string;
  progress: number; // 0..1
}

function SortableImage({
  image,
  index,
  onRemove,
  onSetMain,
  onAltChange,
}: {
  image: ProductImageInput;
  index: number;
  onRemove: (publicId: string) => void;
  onSetMain: (publicId: string) => void;
  onAltChange: (publicId: string, alt: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: image.publicId,
  });
  const isMain = index === 0;

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'group relative overflow-hidden rounded-lg border bg-card',
        isDragging && 'z-10 opacity-80 shadow-lg ring-2 ring-ring',
      )}
    >
      <div className="relative aspect-square overflow-hidden bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={cloudinaryThumb(image.url, 320) ?? image.url}
          alt={image.alt || 'Product image'}
          className="h-full w-full object-cover"
        />
        {isMain ? (
          <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded bg-foreground/85 px-1.5 py-0.5 text-[10px] font-medium text-background">
            <Star className="h-2.5 w-2.5" /> Main
          </span>
        ) : null}
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Reorder ${image.alt || 'image'}`}
          className="absolute right-1.5 top-1.5 cursor-grab rounded bg-background/80 p-1 text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100 active:cursor-grabbing"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => onRemove(image.publicId)}
          aria-label={`Remove ${image.alt || 'image'}`}
          className="absolute bottom-1.5 right-1.5 rounded bg-background/80 p-1 text-muted-foreground opacity-0 transition-opacity hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="space-y-1.5 p-2">
        <Input
          value={image.alt}
          onChange={(e) => onAltChange(image.publicId, e.target.value)}
          placeholder="Alt text…"
          aria-label={`Alt text for image ${index + 1}`}
          className="h-8 text-xs"
        />
        {isMain ? (
          <p className="text-center text-[11px] text-muted-foreground">Main image · shown first</p>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 w-full text-xs"
            onClick={() => onSetMain(image.publicId)}
          >
            <Star className="h-3 w-3" /> Set as main
          </Button>
        )}
      </div>
    </li>
  );
}

export function MediaSection() {
  const form = useFormContext<ProductFormValues>();
  const { setPendingUploads } = useUploadStatus();
  const images = form.watch('images');
  const [uploading, setUploading] = useState<Uploading[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Selection order tracking so the main image (images[0]) is the first file
  // SELECTED, not whichever upload happens to finish first.
  const seqRef = useRef(0);
  const seqByPublicIdRef = useRef(new Map<string, number>());

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Revoke any object URLs still around when the section unmounts.
  const uploadingRef = useRef<Uploading[]>([]);
  uploadingRef.current = uploading;
  useEffect(
    () => () => uploadingRef.current.forEach((u) => URL.revokeObjectURL(u.previewUrl)),
    [],
  );

  // Surface the in-flight count so the form can block Publish / Save-draft while
  // uploads are running (an in-flight image is not yet in `images`).
  useEffect(() => {
    setPendingUploads(uploading.length);
  }, [uploading.length, setPendingUploads]);
  useEffect(() => () => setPendingUploads(0), [setPendingUploads]);

  const startUpload = useCallback(
    (file: File) => {
      const id = crypto.randomUUID();
      const seq = seqRef.current++; // capture selection order up-front
      const previewUrl = URL.createObjectURL(file);
      setUploading((prev) => [...prev, { id, fileName: file.name, previewUrl, progress: 0 }]);

      void (async () => {
        try {
          const sign = await api.uploads.sign('products');
          const uploaded = await uploadToCloudinary(file, sign, {
            onProgress: (fraction) =>
              setUploading((prev) => prev.map((u) => (u.id === id ? { ...u, progress: fraction } : u))),
          });
          const image: ProductImageInput = {
            url: uploaded.url,
            publicId: uploaded.publicId,
            alt: form.getValues('name').trim(),
            ...(uploaded.width ? { width: uploaded.width } : {}),
            ...(uploaded.height ? { height: uploaded.height } : {}),
          };
          // Insert by selection order, not completion order, so the first file
          // selected stays the main image even if a later one uploads faster.
          seqByPublicIdRef.current.set(uploaded.publicId, seq);
          const current = form.getValues('images');
          const at = orderedInsertIndex(current, seq, seqByPublicIdRef.current);
          form.setValue('images', [...current.slice(0, at), image, ...current.slice(at)], {
            shouldDirty: true,
            shouldValidate: true,
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Upload failed.';
          toast.error(`${file.name}: ${msg}`);
        } finally {
          setUploading((prev) => prev.filter((u) => u.id !== id));
          URL.revokeObjectURL(previewUrl);
        }
      })();
    },
    [form],
  );

  const handleFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return;
      const used = form.getValues('images').length + uploadingRef.current.length;
      let slots = MAX_IMAGES - used;
      if (slots <= 0) {
        toast.error(`You can add up to ${MAX_IMAGES} images.`);
        return;
      }
      for (const file of Array.from(fileList)) {
        if (slots <= 0) {
          toast.error(`Only ${MAX_IMAGES} images allowed — some files were skipped.`);
          break;
        }
        const err = validateImageFile(file);
        if (err) {
          toast.error(`${file.name}: ${err}`);
          continue;
        }
        startUpload(file);
        slots -= 1;
      }
    },
    [form, startUpload],
  );

  const removeImage = useCallback(
    (publicId: string) => {
      form.setValue(
        'images',
        form.getValues('images').filter((i) => i.publicId !== publicId),
        { shouldDirty: true, shouldValidate: true },
      );
      seqByPublicIdRef.current.delete(publicId);
      // Delete-on-remove: clean the asset out of Cloudinary immediately so an
      // image removed before the product is saved is never orphaned. Scoped to
      // our own folders server-side; only our uploads carry a woodhouse/ id.
      if (publicId.startsWith('woodhouse/')) {
        api.uploads
          .delete(publicId)
          .catch(() =>
            toast.error('Image removed, but cleaning it up from storage failed — it may remain in Cloudinary.'),
          );
      }
    },
    [form],
  );

  const setMain = useCallback(
    (publicId: string) => {
      const imgs = form.getValues('images');
      const idx = imgs.findIndex((i) => i.publicId === publicId);
      if (idx > 0) {
        form.setValue('images', arrayMove(imgs, idx, 0), { shouldDirty: true, shouldValidate: true });
      }
    },
    [form],
  );

  const setAlt = useCallback(
    (publicId: string, alt: string) => {
      form.setValue(
        'images',
        form.getValues('images').map((i) => (i.publicId === publicId ? { ...i, alt } : i)),
        { shouldDirty: true },
      );
    },
    [form],
  );

  const onDragEnd = useCallback(
    (e: DragEndEvent) => {
      const { active, over } = e;
      if (!over || active.id === over.id) return;
      const imgs = form.getValues('images');
      const oldIndex = imgs.findIndex((i) => i.publicId === active.id);
      const newIndex = imgs.findIndex((i) => i.publicId === over.id);
      if (oldIndex < 0 || newIndex < 0) return;
      form.setValue('images', arrayMove(imgs, oldIndex, newIndex), {
        shouldDirty: true,
        shouldValidate: true,
      });
    },
    [form],
  );

  const hasTiles = images.length > 0 || uploading.length > 0;

  return (
    <FormSection
      id="media"
      title="Media"
      description="Product photos. The first image is the main image shown on cards and the product page."
    >
      <FormField
        control={form.control}
        name="images"
        render={() => (
          <FormItem>
            <FormLabel>Images</FormLabel>
            <FormControl>
              <div className="space-y-4">
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    handleFiles(e.dataTransfer.files);
                  }}
                  className={cn(
                    'flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-8 text-center transition-colors',
                    dragOver ? 'border-primary bg-accent/50' : 'border-input',
                  )}
                >
                  <input
                    ref={inputRef}
                    type="file"
                    accept={ACCEPTED_IMAGE_ACCEPT}
                    multiple
                    className="sr-only"
                    onChange={(e) => {
                      handleFiles(e.target.files);
                      e.target.value = '';
                    }}
                  />
                  <UploadCloud className="mb-2 h-7 w-7 text-muted-foreground" />
                  <p className="text-sm">
                    Drag &amp; drop images here, or{' '}
                    <button
                      type="button"
                      onClick={() => inputRef.current?.click()}
                      className="font-medium text-primary underline-offset-4 hover:underline"
                    >
                      browse
                    </button>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    JPG, PNG or WebP · up to 5 MB each · up to {MAX_IMAGES} images
                  </p>
                </div>

                {hasTiles ? (
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                    <SortableContext items={images.map((i) => i.publicId)} strategy={rectSortingStrategy}>
                      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                        {images.map((image, index) => (
                          <SortableImage
                            key={image.publicId}
                            image={image}
                            index={index}
                            onRemove={removeImage}
                            onSetMain={setMain}
                            onAltChange={setAlt}
                          />
                        ))}
                        {uploading.map((u) => (
                          <li key={u.id} className="overflow-hidden rounded-lg border bg-card">
                            <div className="relative aspect-square overflow-hidden bg-muted">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={u.previewUrl}
                                alt=""
                                className="h-full w-full object-cover opacity-40"
                              />
                              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-muted-foreground">
                                <Loader2 className="h-5 w-5 animate-spin" />
                                <span className="text-xs font-medium">{Math.round(u.progress * 100)}%</span>
                              </div>
                            </div>
                            <div className="h-1 w-full bg-muted">
                              <div
                                className="h-full bg-primary transition-[width]"
                                style={{ width: `${Math.round(u.progress * 100)}%` }}
                              />
                            </div>
                          </li>
                        ))}
                      </ul>
                    </SortableContext>
                  </DndContext>
                ) : null}
              </div>
            </FormControl>
            <FormDescription>
              The first image is the main image — drag to reorder or use “Set as main”. A main image is
              required to publish; a draft can be saved without one.
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
    </FormSection>
  );
}
