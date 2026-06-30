function AppStatusBar({ activeModule }) {
  const icon =
    activeModule === 'vehicles'
      ? '📋'
      : activeModule === 'planning'
        ? '👥'
        : activeModule === 'affaires'
          ? '📁'
          : activeModule === 'equipment'
            ? '🔧'
            : activeModule === 'orders'
              ? '📦'
              : '📊';

  return (
    <div className="vsc-statusbar">
      <span>
        {icon} {activeModule}
      </span>
      <span style={{ marginLeft: 'auto', opacity: 0.7 }}>eM@g v2.0</span>
    </div>
  );
}

export default AppStatusBar;
