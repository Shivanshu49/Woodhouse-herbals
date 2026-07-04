'use client';

import { useEffect } from 'react';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import CharacterCount from '@tiptap/extension-character-count';
import {
  Bold,
  Heading2,
  Heading3,
  Italic,
  Link2,
  List,
  ListOrdered,
} from 'lucide-react';
import { cn } from '@/lib/cn';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  /** Short-description mode: no block formatting, emits plain text. */
  plainText?: boolean;
  /** Character limit — shows a live counter and hard-caps input. */
  limit?: number;
  invalid?: boolean;
  className?: string;
  ariaLabel?: string;
}

function ToolbarButton({
  active,
  onClick,
  label,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={cn(
        'flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground [&_svg]:h-4 [&_svg]:w-4',
        active && 'bg-accent text-foreground',
      )}
    >
      {children}
    </button>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const setLink = () => {
    const prev = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('Link URL', prev ?? 'https://');
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-input px-1.5 py-1">
      <ToolbarButton label="Bold" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
        <Bold />
      </ToolbarButton>
      <ToolbarButton label="Italic" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <Italic />
      </ToolbarButton>
      <span className="mx-1 h-4 w-px bg-border" />
      <ToolbarButton label="Heading 2" active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
        <Heading2 />
      </ToolbarButton>
      <ToolbarButton label="Heading 3" active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
        <Heading3 />
      </ToolbarButton>
      <span className="mx-1 h-4 w-px bg-border" />
      <ToolbarButton label="Bullet list" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <List />
      </ToolbarButton>
      <ToolbarButton label="Numbered list" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        <ListOrdered />
      </ToolbarButton>
      <span className="mx-1 h-4 w-px bg-border" />
      <ToolbarButton label="Link" active={editor.isActive('link')} onClick={setLink}>
        <Link2 />
      </ToolbarButton>
    </div>
  );
}

const CONTENT_CLASS =
  'w-full px-3 py-2 text-sm focus:outline-none [&_p]:leading-relaxed [&_h2]:mt-2 [&_h2]:text-base [&_h2]:font-semibold [&_h3]:mt-2 [&_h3]:text-sm [&_h3]:font-semibold [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:text-primary [&_a]:underline';

export function RichTextEditor({
  value,
  onChange,
  onBlur,
  placeholder,
  plainText = false,
  limit,
  invalid = false,
  className,
  ariaLabel,
}: RichTextEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure(
        plainText
          ? {
              heading: false,
              bulletList: false,
              orderedList: false,
              blockquote: false,
              codeBlock: false,
              horizontalRule: false,
            }
          : { heading: { levels: [2, 3] } },
      ),
      ...(plainText ? [] : [Link.configure({ openOnClick: false, autolink: true })]),
      Placeholder.configure({ placeholder: placeholder ?? '' }),
      CharacterCount.configure(limit ? { limit } : {}),
    ],
    content: value || '',
    editorProps: {
      attributes: {
        class: cn(CONTENT_CLASS, plainText ? 'min-h-[3.5rem]' : 'min-h-[9rem]'),
        ...(ariaLabel ? { 'aria-label': ariaLabel } : {}),
      },
    },
    onUpdate: ({ editor }) => onChange(plainText ? editor.getText() : editor.getHTML()),
    onBlur: () => onBlur?.(),
  });

  // Keep the editor in sync when the field value changes from outside (e.g.
  // form reset, or loading an existing product on the edit page).
  useEffect(() => {
    if (!editor) return;
    const current = plainText ? editor.getText() : editor.getHTML();
    if (value !== current) editor.commands.setContent(value || '', false);
  }, [value, editor, plainText]);

  const chars: number = editor?.storage.characterCount?.characters() ?? 0;

  return (
    <div
      className={cn(
        'rounded-md border border-input bg-transparent focus-within:ring-2 focus-within:ring-ring',
        invalid && 'border-destructive',
        className,
      )}
    >
      {!plainText && editor ? <Toolbar editor={editor} /> : null}
      <EditorContent editor={editor} />
      {limit != null ? (
        <div
          className={cn(
            'px-3 pb-1.5 text-right text-xs',
            chars >= limit ? 'text-destructive' : chars > limit * 0.9 ? 'text-amber-600' : 'text-muted-foreground',
          )}
        >
          {chars}/{limit}
        </div>
      ) : null}
    </div>
  );
}
