import React, { useEffect, useState } from 'react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import Card from '@shared/components/ui/Card';
import Badge from '@shared/components/ui/Badge';
import Modal from '@shared/components/ui/Modal';
import { useToast } from '@shared/components/ui/Toast';
import { adminApi } from '../services/adminApi';
import {
  HiOutlinePlus,
  HiOutlineDocumentText,
  HiOutlinePencilSquare,
  HiOutlineTrash
} from 'react-icons/hi2';

const DynamicPagesManager = () => {
  const { showToast } = useToast();
  const [pages, setPages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSlug, setEditingSlug] = useState(null);

  const [formData, setFormData] = useState({
    slug: '',
    title: '',
    content: '',
    metaTitle: '',
    metaDescription: '',
    status: 'active',
  });

  const loadPages = async () => {
    setIsLoading(true);
    try {
      const res = await adminApi.getDynamicPages();
      setPages(res.data.results || res.data.result || res.data || []);
    } catch (error) {
      console.error(error);
      showToast('Failed to load static pages', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPages();
  }, []);

  const resetForm = () => {
    setFormData({
      slug: '',
      title: '',
      content: '',
      metaTitle: '',
      metaDescription: '',
      status: 'active',
    });
    setEditingSlug(null);
  };

  const openCreateModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const openEditModal = (page) => {
    setFormData({
      slug: page.slug,
      title: page.title,
      content: page.content || '',
      metaTitle: page.metaTitle || '',
      metaDescription: page.metaDescription || '',
      status: page.status || 'active',
    });
    setEditingSlug(page.slug);
    setIsModalOpen(true);
  };

  const handleDelete = async (slug) => {
    if (!window.confirm('Are you sure you want to delete this page?')) return;
    try {
      await adminApi.deleteDynamicPage(slug);
      showToast('Page deleted successfully', 'success');
      loadPages();
    } catch (error) {
      console.error(error);
      showToast('Failed to delete page', 'error');
    }
  };

  const handleSave = async () => {
    if (!formData.slug.trim() || !formData.title.trim()) {
      showToast('Slug and Title are required', 'warning');
      return;
    }
    
    // Auto-format slug
    const finalSlug = formData.slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');

    try {
      await adminApi.upsertDynamicPage(finalSlug, {
        ...formData,
        slug: finalSlug
      });
      showToast(editingSlug ? 'Page updated' : 'Page created', 'success');
      setIsModalOpen(false);
      loadPages();
    } catch (error) {
      console.error(error);
      showToast(error?.response?.data?.message || 'Failed to save page', 'error');
    }
  };

  const quillModules = {
    toolbar: [
      [{ 'header': [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike', 'blockquote'],
      [{ 'list': 'ordered' }, { 'list': 'bullet' }],
      ['link', 'image'],
      ['clean']
    ],
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between px-2">
        <h3 className="text-xs font-black text-slate-900 uppercase tracking-[0.2em]">
          Static Pages ({pages.length})
        </h3>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md hover:scale-105 transition-all"
        >
          <HiOutlinePlus className="h-4 w-4" />
          Add Page
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-10"><span className="text-sm font-bold text-slate-400">Loading pages...</span></div>
      ) : pages.length === 0 ? (
        <div className="text-center py-16 bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-100">
          <HiOutlineDocumentText className="h-10 w-10 text-slate-200 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">
            No static pages found
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Click &quot;Add Page&quot; to create Privacy, Terms, FAQ, etc.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {pages.map((page) => (
            <Card key={page._id} className="p-4 border-none shadow-lg ring-1 ring-slate-100 bg-white rounded-xl group">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 shrink-0">
                  <HiOutlineDocumentText className="h-6 w-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                      /{page.slug}
                    </span>
                    <Badge variant={page.status === 'active' ? 'success' : 'secondary'} className="text-[8px] font-black uppercase">
                      {page.status}
                    </Badge>
                  </div>
                  <h4 className="text-sm font-black text-slate-900 mb-1">{page.title}</h4>
                  <p className="text-[11px] text-slate-500 truncate max-w-xl">{page.metaDescription || 'No description'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => openEditModal(page)} className="p-2 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-xl transition-all">
                    <HiOutlinePencilSquare className="h-5 w-5" />
                  </button>
                  <button onClick={() => handleDelete(page.slug)} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all">
                    <HiOutlineTrash className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Editor Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingSlug ? "Edit Static Page" : "Create Static Page"}>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Page Title <span className="text-rose-500">*</span></label>
              <input
                value={formData.title}
                onChange={e => setFormData({ ...formData, title: e.target.value })}
                className="w-full p-3 bg-slate-50 rounded-xl text-sm font-bold border-none outline-none"
                placeholder="E.g. Privacy Policy"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">URL Slug <span className="text-rose-500">*</span></label>
              <input
                value={formData.slug}
                disabled={!!editingSlug}
                onChange={e => setFormData({ ...formData, slug: e.target.value })}
                className="w-full p-3 bg-slate-50 rounded-xl text-sm font-bold border-none outline-none disabled:opacity-50"
                placeholder="privacy-policy"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Page Content</label>
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <ReactQuill 
                theme="snow" 
                value={formData.content} 
                onChange={(val) => setFormData({ ...formData, content: val })} 
                modules={quillModules}
                className="min-h-[300px]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Meta Title (SEO)</label>
              <input
                value={formData.metaTitle}
                onChange={e => setFormData({ ...formData, metaTitle: e.target.value })}
                className="w-full p-3 bg-slate-50 rounded-xl text-xs font-bold border-none outline-none"
                placeholder="Optional SEO title"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</label>
              <select
                value={formData.status}
                onChange={e => setFormData({ ...formData, status: e.target.value })}
                className="w-full p-3 bg-slate-50 rounded-xl text-xs font-black outline-none"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
          
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Meta Description (SEO)</label>
            <textarea
              value={formData.metaDescription}
              onChange={e => setFormData({ ...formData, metaDescription: e.target.value })}
              className="w-full p-3 bg-slate-50 rounded-xl text-xs font-medium border-none outline-none min-h-[80px]"
              placeholder="Optional SEO description"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              onClick={() => setIsModalOpen(false)}
              className="px-5 py-2.5 rounded-xl text-xs font-black text-slate-400 hover:text-slate-600 hover:bg-slate-50"
            >
              CANCEL
            </button>
            <button
              onClick={handleSave}
              className="px-6 py-2.5 bg-primary text-white rounded-xl text-xs font-black shadow-lg shadow-primary/30 hover:scale-105 transition-all"
            >
              SAVE PAGE
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default DynamicPagesManager;
