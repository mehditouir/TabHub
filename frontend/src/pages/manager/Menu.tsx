import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  getCategories, createCategory, updateCategory, deleteCategory,
  getMenuItems, createMenuItem, updateMenuItem, deleteMenuItem,
  uploadMenuItemImage,
} from '@/lib/api/menu'
import { formatPrice } from '@/lib/utils'
import type { Category, MenuItem } from '@/lib/types'

// ── Overlay ───────────────────────────────────────────────────────────────────

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div role="dialog" className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        {children}
      </div>
    </div>
  )
}

const inputCls = 'rounded border border-zinc-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand'

// ── CategoryFormModal ─────────────────────────────────────────────────────────

interface CategoryFormModalProps {
  initial?: Category
  onSave:  (data: { name: string; sortOrder: number; isActive: boolean }) => Promise<void>
  onClose: () => void
}

function CategoryFormModal({ initial, onSave, onClose }: CategoryFormModalProps) {
  const { t } = useTranslation()
  const [name,      setName]      = useState(initial?.name      ?? '')
  const [sortOrder, setSortOrder] = useState(initial?.sortOrder ?? 0)
  const [isActive,  setIsActive]  = useState(initial?.isActive  ?? true)
  const [saving,    setSaving]    = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try { await onSave({ name, sortOrder, isActive }) }
    finally { setSaving(false) }
  }

  return (
    <Overlay onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">
          {initial ? t('menu.editCategory') : t('menu.newCategoryTitle')}
        </h2>

        <label className="flex flex-col gap-1 text-sm">
          {t('common.name')}
          <input
            data-testid="input-cat-name"
            className={inputCls}
            value={name} onChange={e => setName(e.target.value)}
            required maxLength={100} autoFocus
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          {t('common.sortOrder')}
          <input type="number" min={0} className={inputCls}
            value={sortOrder} onChange={e => setSortOrder(Number(e.target.value))} />
        </label>

        {initial && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} />
            {t('common.active')}
          </label>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-100">
            {t('common.cancel')}
          </button>
          <button type="submit" disabled={saving}
            className="rounded-lg bg-brand px-4 py-2 text-sm text-white disabled:opacity-60">
            {saving ? t('common.saving') : t('common.save')}
          </button>
        </div>
      </form>
    </Overlay>
  )
}

// ── MenuItemFormModal ─────────────────────────────────────────────────────────

interface MenuItemFormModalProps {
  initial?:    MenuItem
  categoryId:  string
  categories:  Category[]
  onSave:      (data: {
    categoryId: string; name: string; price: number; isAvailable: boolean
    description?: string; sortOrder: number; imageFile?: File
  }) => Promise<void>
  onDelete?:   () => Promise<void>
  onClose:     () => void
}

function MenuItemFormModal({ initial, categoryId, categories, onSave, onDelete, onClose }: MenuItemFormModalProps) {
  const { t } = useTranslation()
  const fileRef = useRef<HTMLInputElement>(null)

  const [catId,        setCatId]        = useState(initial?.categoryId  ?? categoryId)
  const [name,         setName]         = useState(initial?.name        ?? '')
  const [price,        setPrice]        = useState(initial?.price       ?? 0)
  const [description,  setDescription]  = useState(initial?.description ?? '')
  const [sortOrder,    setSortOrder]    = useState(initial?.sortOrder   ?? 0)
  const [isAvailable,  setIsAvailable]  = useState(initial?.isAvailable ?? true)
  const [imageFile,    setImageFile]    = useState<File | undefined>()
  const [previewUrl,   setPreviewUrl]   = useState<string | undefined>(initial?.imageUrl ?? undefined)
  const [saving,       setSaving]       = useState(false)
  const [deleting,     setDeleting]     = useState(false)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setPreviewUrl(URL.createObjectURL(file))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await onSave({
        categoryId: catId,
        name,
        price,
        isAvailable,
        description: description.trim() || undefined,
        sortOrder,
        imageFile,
      })
    } finally { setSaving(false) }
  }

  async function handleDelete() {
    if (!onDelete) return
    setDeleting(true)
    try { await onDelete() }
    finally { setDeleting(false) }
  }

  return (
    <Overlay onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">{initial ? t('menu.editItem') : t('menu.newItem')}</h2>

        <label className="flex flex-col gap-1 text-sm">
          {t('menu.category')}
          <select className={inputCls} value={catId} onChange={e => setCatId(e.target.value)}>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          {t('common.name')}
          <input
            data-testid="input-item-name"
            className={inputCls}
            value={name} onChange={e => setName(e.target.value)}
            required maxLength={150} autoFocus={!initial}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          {t('menu.price')}
          <input data-testid="input-item-price" type="number" min={0} step={0.01} className={inputCls}
            value={price} onChange={e => setPrice(Number(e.target.value))} required />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          {t('menu.description')}
          <textarea
            className={`${inputCls} resize-none`}
            rows={2} maxLength={500}
            value={description} onChange={e => setDescription(e.target.value)}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          {t('common.sortOrder')}
          <input type="number" min={0} className={inputCls}
            value={sortOrder} onChange={e => setSortOrder(Number(e.target.value))} />
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={isAvailable} onChange={e => setIsAvailable(e.target.checked)} />
          {t('menu.available')}
        </label>

        {/* Photo upload */}
        <div className="flex flex-col gap-1 text-sm">
          <span>{t('menu.photo')}</span>
          {previewUrl && (
            <img
              src={previewUrl}
              alt="preview"
              className="h-20 w-20 rounded-lg object-cover border border-zinc-200"
            />
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="self-start rounded border border-zinc-300 px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-50"
          >
            {previewUrl ? t('menu.changePhoto') : t('menu.uploadPhoto')}
          </button>
        </div>

        <div className="flex items-center justify-between pt-2">
          {onDelete ? (
            <button type="button" onClick={handleDelete} disabled={deleting}
              className="rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-60">
              {deleting ? t('common.deleting') : t('common.delete')}
            </button>
          ) : <div />}
          <div className="flex gap-2">
            <button type="button" onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-100">
              {t('common.cancel')}
            </button>
            <button type="submit" disabled={saving}
              className="rounded-lg bg-brand px-4 py-2 text-sm text-white disabled:opacity-60">
              {saving ? t('common.saving') : t('common.save')}
            </button>
          </div>
        </div>
      </form>
    </Overlay>
  )
}

// ── Menu (main page) ──────────────────────────────────────────────────────────

type CategoryModal = 'create' | Category
type ItemModal     = { categoryId: string } | MenuItem

export function Menu() {
  const { t } = useTranslation()
  const [categories,    setCategories]    = useState<Category[]>([])
  const [items,         setItems]         = useState<MenuItem[]>([])
  const [loading,       setLoading]       = useState(true)
  const [collapsed,     setCollapsed]     = useState<Set<string>>(new Set())
  const [categoryModal, setCategoryModal] = useState<CategoryModal | null>(null)
  const [itemModal,     setItemModal]     = useState<ItemModal | null>(null)

  useEffect(() => {
    Promise.all([getCategories(), getMenuItems()])
      .then(([cats, its]) => { setCategories(cats); setItems(its) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  function toggleCollapse(id: string) {
    setCollapsed(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function itemsForCategory(categoryId: string) {
    return items
      .filter(i => i.categoryId === categoryId)
      .sort((a, b) => a.sortOrder - b.sortOrder)
  }

  // ── Category handlers ──────────────────────────────────────────────────────

  async function handleCreateCategory(data: { name: string; sortOrder: number; isActive: boolean }) {
    const { isActive: _ignored, ...createData } = data
    const created = await createCategory(createData.name, createData.sortOrder)
    setCategories(prev => [...prev, created].sort((a, b) => a.sortOrder - b.sortOrder))
    setCategoryModal(null)
  }

  async function handleUpdateCategory(cat: Category, data: { name: string; sortOrder: number; isActive: boolean }) {
    const updated = await updateCategory(cat.id, data)
    setCategories(prev => prev.map(c => c.id === updated.id ? updated : c).sort((a, b) => a.sortOrder - b.sortOrder))
    setCategoryModal(null)
  }

  async function handleDeleteCategory(cat: Category) {
    if (!confirm(t('menu.deleteCategory', { name: cat.name }))) return
    await deleteCategory(cat.id)
    setCategories(prev => prev.filter(c => c.id !== cat.id))
    setItems(prev => prev.filter(i => i.categoryId !== cat.id))
    setCategoryModal(null)
  }

  // ── Item handlers ──────────────────────────────────────────────────────────

  async function handleCreateItem(data: {
    categoryId: string; name: string; price: number; isAvailable: boolean
    description?: string; sortOrder: number; imageFile?: File
  }) {
    const { imageFile, ...itemData } = data
    const created = await createMenuItem(itemData)
    if (imageFile) {
      const { imageUrl } = await uploadMenuItemImage(created.id, imageFile)
      setItems(prev => [...prev, { ...created, imageUrl }])
    } else {
      setItems(prev => [...prev, created])
    }
    setItemModal(null)
  }

  async function handleUpdateItem(item: MenuItem, data: {
    categoryId: string; name: string; price: number; isAvailable: boolean
    description?: string; sortOrder: number; imageFile?: File
  }) {
    const { imageFile, ...itemData } = data
    const updated = await updateMenuItem(item.id, itemData)
    if (imageFile) {
      const { imageUrl } = await uploadMenuItemImage(updated.id, imageFile)
      setItems(prev => prev.map(i => i.id === updated.id ? { ...updated, imageUrl } : i))
    } else {
      setItems(prev => prev.map(i => i.id === updated.id ? updated : i))
    }
    setItemModal(null)
  }

  async function handleDeleteItem(item: MenuItem) {
    await deleteMenuItem(item.id)
    setItems(prev => prev.filter(i => i.id !== item.id))
    setItemModal(null)
  }

  if (loading) return <div className="text-zinc-500">{t('common.loading')}</div>

  const sortedCategories = [...categories].sort((a, b) => a.sortOrder - b.sortOrder)

  const isItemEdit   = itemModal !== null && 'id' in itemModal
  const isItemCreate = itemModal !== null && !isItemEdit

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900">{t('menu.title')}</h1>
        <button
          data-testid="btn-add-category"
          onClick={() => setCategoryModal('create')}
          className="rounded-lg bg-brand px-4 py-2 text-sm text-white hover:bg-brand/80"
        >
          {t('menu.newCategory')}
        </button>
      </div>

      {sortedCategories.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-zinc-200 p-12 text-center text-zinc-400">
          {t('menu.noCategories')}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {sortedCategories.map(cat => {
            const catItems = itemsForCategory(cat.id)
            const isOpen   = !collapsed.has(cat.id)

            return (
              <div key={cat.id} className="rounded-xl border border-zinc-200 bg-white">
                {/* Category header */}
                <div className="flex items-center gap-3 px-4 py-3">
                  <button
                    onClick={() => toggleCollapse(cat.id)}
                    className="flex flex-1 items-center gap-2 text-start"
                  >
                    <span className={`text-zinc-400 transition-transform ${isOpen ? 'rotate-90' : ''}`}>▶</span>
                    <span className="font-semibold text-zinc-900">{cat.name}</span>
                    {!cat.isActive && (
                      <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-400">{t('common.inactive')}</span>
                    )}
                    <span className="ml-1 text-xs text-zinc-400">
                      {catItems.length} {catItems.length !== 1 ? t('menu.items') : t('menu.item')}
                    </span>
                  </button>

                  <div className="flex shrink-0 gap-2">
                    <button
                      data-testid="btn-add-item"
                      onClick={() => setItemModal({ categoryId: cat.id })}
                      className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100"
                    >
                      {t('menu.addItem')}
                    </button>
                    <button
                      onClick={() => setCategoryModal(cat)}
                      className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100"
                    >
                      {t('common.edit')}
                    </button>
                    <button
                      onClick={() => handleDeleteCategory(cat)}
                      className="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
                    >
                      {t('common.delete')}
                    </button>
                  </div>
                </div>

                {/* Items list */}
                {isOpen && (
                  <div className="border-t border-zinc-100">
                    {catItems.length === 0 ? (
                      <p className="px-6 py-4 text-sm text-zinc-400">{t('menu.noItems')}</p>
                    ) : (
                      <ul>
                        {catItems.map((item, idx) => (
                          <li
                            key={item.id}
                            className={`flex items-center gap-3 px-6 py-3 ${idx > 0 ? 'border-t border-zinc-50' : ''}`}
                          >
                            {item.imageUrl && (
                              <img
                                src={item.imageUrl}
                                alt={item.name}
                                className="h-10 w-10 rounded-lg object-cover shrink-0"
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-zinc-900 truncate">{item.name}</span>
                                {!item.isAvailable && (
                                  <span className="rounded bg-red-50 px-1.5 py-0.5 text-xs text-red-500">{t('menu.unavailable')}</span>
                                )}
                              </div>
                              {item.description && (
                                <p className="mt-0.5 text-xs text-zinc-400 truncate">{item.description}</p>
                              )}
                            </div>
                            <span className="shrink-0 text-sm font-semibold text-zinc-700">
                              {formatPrice(item.price)}
                            </span>
                            <button
                              onClick={() => setItemModal(item)}
                              className="shrink-0 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-100"
                            >
                              {t('common.edit')}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Category modal */}
      {categoryModal !== null && (
        <CategoryFormModal
          initial={categoryModal === 'create' ? undefined : categoryModal}
          onSave={
            categoryModal === 'create'
              ? handleCreateCategory
              : data => handleUpdateCategory(categoryModal as Category, data)
          }
          onClose={() => setCategoryModal(null)}
        />
      )}

      {/* Item modal */}
      {itemModal !== null && (
        <MenuItemFormModal
          initial={isItemEdit ? (itemModal as MenuItem) : undefined}
          categoryId={isItemCreate ? (itemModal as { categoryId: string }).categoryId : (itemModal as MenuItem).categoryId}
          categories={categories}
          onSave={
            isItemEdit
              ? data => handleUpdateItem(itemModal as MenuItem, data)
              : handleCreateItem
          }
          onDelete={isItemEdit ? () => handleDeleteItem(itemModal as MenuItem) : undefined}
          onClose={() => setItemModal(null)}
        />
      )}
    </div>
  )
}
