const AddIntakeButton = ({ onClick, disabled }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full py-3 rounded-xl font-black text-base transition-all duration-300 hover:scale-[1.02] hover:-translate-y-0.5 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed group relative overflow-hidden"
      style={{
        background: 'var(--add-btn-bg)',
        color: 'var(--add-btn-text)',
        border: '1px solid var(--add-btn-border)',
        boxShadow: '0 10px 24px var(--shadow-color-strong), 0 0 14px var(--add-btn-glow)'
      }}
    >
      <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
      <span className="inline-flex items-center justify-center gap-2 relative z-10">
        <span className="text-xl leading-none">+</span>
        Додати
      </span>
    </button>
  );
};

export default AddIntakeButton;

