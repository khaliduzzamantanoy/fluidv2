export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#090d16] text-white">
      <div className="text-center space-y-3">
        <h1 className="text-4xl font-bold text-brand-400">404</h1>
        <p className="text-gray-400 text-sm">Page not found</p>
        <a href="/" className="inline-block px-4 py-2 bg-brand-500 rounded-lg text-xs font-semibold">
          Return to Fluid Wizard
        </a>
      </div>
    </div>
  );
}
