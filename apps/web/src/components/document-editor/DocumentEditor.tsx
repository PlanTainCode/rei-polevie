import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import { useState, useEffect, useCallback } from 'react';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Heading3,
  Highlighter,
  Undo,
  Redo,
  Save,
  Edit3,
  Eye,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui';

interface DocumentEditorProps {
  htmlContent: string;
  onSave?: (html: string) => Promise<void>;
  readOnly?: boolean;
  className?: string;
}

const MenuButton = ({
  onClick,
  isActive,
  disabled,
  children,
  title,
}: {
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  title: string;
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    title={title}
    className={`
      p-2 rounded-lg transition-all duration-200
      ${isActive 
        ? 'bg-cyan-500/20 text-cyan-400 shadow-inner' 
        : 'hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)]'
      }
      ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:text-[var(--text-primary)]'}
    `}
  >
    {children}
  </button>
);

const Divider = () => (
  <div className="w-px h-6 bg-[var(--border-primary)] mx-1" />
);

export function DocumentEditor({ 
  htmlContent, 
  onSave, 
  readOnly: initialReadOnly = true,
  className = '' 
}: DocumentEditorProps) {
  const [isEditing, setIsEditing] = useState(!initialReadOnly);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Underline,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Highlight.configure({
        multicolor: false,
      }),
    ],
    content: htmlContent,
    editable: isEditing,
    onUpdate: () => {
      setHasChanges(true);
    },
  });

  useEffect(() => {
    if (editor) {
      editor.setEditable(isEditing);
    }
  }, [isEditing, editor]);

  useEffect(() => {
    if (editor && htmlContent !== editor.getHTML()) {
      editor.commands.setContent(htmlContent);
      setHasChanges(false);
    }
  }, [htmlContent, editor]);

  const handleSave = useCallback(async () => {
    if (!editor || !onSave) return;
    
    setIsSaving(true);
    try {
      await onSave(editor.getHTML());
      setHasChanges(false);
    } finally {
      setIsSaving(false);
    }
  }, [editor, onSave]);

  const toggleEditMode = useCallback(() => {
    setIsEditing(prev => !prev);
  }, []);

  if (!editor) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
      </div>
    );
  }

  return (
    <div className={`flex flex-col border border-[var(--border-primary)] rounded-xl overflow-hidden bg-[var(--bg-secondary)] ${className}`}>
      {/* Toolbar */}
      <div className="flex items-center gap-1 p-2 border-b border-[var(--border-primary)] bg-[var(--bg-tertiary)] flex-wrap">
        {/* Mode toggle */}
        <Button
          variant={isEditing ? 'primary' : 'secondary'}
          size="sm"
          onClick={toggleEditMode}
          className="mr-2"
        >
          {isEditing ? (
            <>
              <Eye className="w-4 h-4" />
              Просмотр
            </>
          ) : (
            <>
              <Edit3 className="w-4 h-4" />
              Редактировать
            </>
          )}
        </Button>

        {isEditing && (
          <>
            <Divider />

            {/* Undo/Redo */}
            <MenuButton
              onClick={() => editor.chain().focus().undo().run()}
              disabled={!editor.can().undo()}
              title="Отменить"
            >
              <Undo className="w-4 h-4" />
            </MenuButton>
            <MenuButton
              onClick={() => editor.chain().focus().redo().run()}
              disabled={!editor.can().redo()}
              title="Повторить"
            >
              <Redo className="w-4 h-4" />
            </MenuButton>

            <Divider />

            {/* Headings */}
            <MenuButton
              onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
              isActive={editor.isActive('heading', { level: 1 })}
              title="Заголовок 1"
            >
              <Heading1 className="w-4 h-4" />
            </MenuButton>
            <MenuButton
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              isActive={editor.isActive('heading', { level: 2 })}
              title="Заголовок 2"
            >
              <Heading2 className="w-4 h-4" />
            </MenuButton>
            <MenuButton
              onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
              isActive={editor.isActive('heading', { level: 3 })}
              title="Заголовок 3"
            >
              <Heading3 className="w-4 h-4" />
            </MenuButton>

            <Divider />

            {/* Text formatting */}
            <MenuButton
              onClick={() => editor.chain().focus().toggleBold().run()}
              isActive={editor.isActive('bold')}
              title="Жирный"
            >
              <Bold className="w-4 h-4" />
            </MenuButton>
            <MenuButton
              onClick={() => editor.chain().focus().toggleItalic().run()}
              isActive={editor.isActive('italic')}
              title="Курсив"
            >
              <Italic className="w-4 h-4" />
            </MenuButton>
            <MenuButton
              onClick={() => editor.chain().focus().toggleUnderline().run()}
              isActive={editor.isActive('underline')}
              title="Подчёркнутый"
            >
              <UnderlineIcon className="w-4 h-4" />
            </MenuButton>
            <MenuButton
              onClick={() => editor.chain().focus().toggleHighlight().run()}
              isActive={editor.isActive('highlight')}
              title="Выделение"
            >
              <Highlighter className="w-4 h-4" />
            </MenuButton>

            <Divider />

            {/* Alignment */}
            <MenuButton
              onClick={() => editor.chain().focus().setTextAlign('left').run()}
              isActive={editor.isActive({ textAlign: 'left' })}
              title="По левому краю"
            >
              <AlignLeft className="w-4 h-4" />
            </MenuButton>
            <MenuButton
              onClick={() => editor.chain().focus().setTextAlign('center').run()}
              isActive={editor.isActive({ textAlign: 'center' })}
              title="По центру"
            >
              <AlignCenter className="w-4 h-4" />
            </MenuButton>
            <MenuButton
              onClick={() => editor.chain().focus().setTextAlign('right').run()}
              isActive={editor.isActive({ textAlign: 'right' })}
              title="По правому краю"
            >
              <AlignRight className="w-4 h-4" />
            </MenuButton>
            <MenuButton
              onClick={() => editor.chain().focus().setTextAlign('justify').run()}
              isActive={editor.isActive({ textAlign: 'justify' })}
              title="По ширине"
            >
              <AlignJustify className="w-4 h-4" />
            </MenuButton>

            <Divider />

            {/* Lists */}
            <MenuButton
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              isActive={editor.isActive('bulletList')}
              title="Маркированный список"
            >
              <List className="w-4 h-4" />
            </MenuButton>
            <MenuButton
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              isActive={editor.isActive('orderedList')}
              title="Нумерованный список"
            >
              <ListOrdered className="w-4 h-4" />
            </MenuButton>

            {/* Save button */}
            {onSave && (
              <>
                <div className="flex-1" />
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSave}
                  disabled={!hasChanges || isSaving}
                >
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Сохранить
                </Button>
              </>
            )}
          </>
        )}
      </div>

      {/* Editor content */}
      <div className={`
        p-6 min-h-[400px] max-h-[600px] overflow-y-auto
        prose prose-invert max-w-none
        ${isEditing ? 'bg-white/5' : ''}
      `}>
        <EditorContent 
          editor={editor} 
          className="focus:outline-none"
        />
      </div>

      {/* Status bar */}
      {isEditing && hasChanges && (
        <div className="px-4 py-2 bg-amber-500/10 border-t border-amber-500/30 text-amber-400 text-sm flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          Есть несохранённые изменения
        </div>
      )}
    </div>
  );
}

