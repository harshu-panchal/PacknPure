import React from "react";
import Modal from "@shared/components/ui/Modal";

export const SupplyFormModal = ({
  isOpen,
  onClose,
  title,
  fields = [],
  values = {},
  onChange,
  onSubmit,
  submitLabel = "Save",
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-bold uppercase tracking-wide text-slate-600 hover:bg-slate-50">
            Cancel
          </button>
          <button
            type="button"
            onClick={onSubmit}
            className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold uppercase tracking-wide text-white hover:bg-slate-800">
            {submitLabel}
          </button>
        </>
      }>
      <div className="grid gap-4">
        {fields.map((field) => (
          <label key={field.key} className="grid gap-1.5">
            <span className="text-[11px] font-black uppercase tracking-wide text-slate-600">
              {field.label}
            </span>
            {field.type === "select" ? (
              <select
                value={values[field.key] ?? ""}
                onChange={(e) => onChange(field.key, e.target.value)}
                className="h-10 rounded-lg border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-slate-400">
                {(field.options || []).map((option) => (
                  <option
                    key={typeof option === "object" ? option.value : option}
                    value={typeof option === "object" ? option.value : option}>
                    {typeof option === "object" ? option.label : option}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type={field.type || "text"}
                value={values[field.key] ?? ""}
                onChange={(e) => onChange(field.key, e.target.value)}
                placeholder={field.placeholder || ""}
                className="h-10 rounded-lg border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-slate-400"
              />
            )}
          </label>
        ))}
      </div>
    </Modal>
  );
};

export const SupplyConfirmModal = ({
  isOpen,
  onClose,
  title,
  message,
  confirmLabel = "Confirm",
  onConfirm,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-bold uppercase tracking-wide text-slate-600 hover:bg-slate-50">
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-bold uppercase tracking-wide text-white hover:bg-rose-700">
            {confirmLabel}
          </button>
        </>
      }>
      <p className="text-sm text-slate-700">{message}</p>
    </Modal>
  );
};

export const SupplyInfoModal = ({ isOpen, onClose, title, message }) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      footer={
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold uppercase tracking-wide text-white hover:bg-slate-800">
          OK
        </button>
      }>
      <p className="text-sm text-slate-700 whitespace-pre-wrap">{message}</p>
    </Modal>
  );
};

export const SupplyDetailsModal = ({ isOpen, onClose, title, data = [] }) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      footer={
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold uppercase tracking-wide text-white hover:bg-slate-800">
          Close
        </button>
      }>
      <div className="grid grid-cols-2 gap-x-6 gap-y-4">
        {data.map((item, idx) => (
          <div key={idx} className={item.fullWidth ? "col-span-2" : "col-span-1"}>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">
              {item.label}
            </span>
            <span className="text-sm font-semibold text-slate-900 block break-words">
              {item.value || "N/A"}
            </span>
          </div>
        ))}
      </div>
    </Modal>
  );
};

export default SupplyFormModal;
