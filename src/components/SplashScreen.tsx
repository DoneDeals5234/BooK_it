export function SplashScreen() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-between relative overflow-hidden py-8"
      style={{
        background: '#FF0000',
        backgroundAttachment: 'fixed',
      }}
    >
      {/* Logo Image - Top Section */}
      <div className="flex flex-col items-center justify-center px-4 flex-1">
        <img
          src="https://cdn.builder.io/api/v1/image/assets%2Fa9f39de2d72141dda737ab464b807d61%2F271a4627da4246a986a55c004453aaac?format=webp&width=800&height=1200"
          alt="Book it Logo"
          style={{
            maxWidth: '100%',
            maxHeight: '60vh',
            objectFit: 'contain',
            objectPosition: 'center',
          }}
        />
      </div>

      {/* Powered By Text - Bottom Section */}
      <div className="text-center pb-6 px-4 mt-auto">
        <p className="text-white text-sm opacity-75">
          POWERED BY<br />
          <span className="font-semibold">paramvir.org</span>
        </p>
      </div>

    </div>
  );
}
