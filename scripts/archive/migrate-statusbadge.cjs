const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'apps/web/src/components/orders/OrdersPanel.jsx');
let code = fs.readFileSync(file, 'utf8');
let count = 0;

// Pattern B2 first (most specific — has flexShrink)
code = code.replace(
  /<span className="status-badge" style=\{\{ backgroundColor: status\.color \+ '20', color: status\.color, borderColor: status\.color, fontSize: '0\.7rem', padding: '2px 8px', flexShrink: 0 \}\}>/g,
  () => { count++; return '<StatusBadge color={status.color} size="sm" style={{ flexShrink: 0 }}>'; }
);

// Pattern B1 (fontSize/padding but no flexShrink)
code = code.replace(
  /<span className="status-badge" style=\{\{ backgroundColor: status\.color \+ '20', color: status\.color, borderColor: status\.color, fontSize: '0\.7rem', padding: '2px 8px' \}\}>/g,
  () => { count++; return '<StatusBadge color={status.color} size="sm">'; }
);

// Pattern A: regular status-badge with borderColor
code = code.replace(
  /<span className="status-badge" style=\{\{ backgroundColor: status\.color \+ '20', color: status\.color, borderColor: status\.color \}\}>/g,
  () => { count++; return '<StatusBadge color={status.color}>'; }
);

// Pattern D: ORDER_STATUS[w.status] inline (before Pattern C to avoid partial match)
code = code.replace(
  /<span className="status-badge small" style=\{\{ backgroundColor: \(ORDER_STATUS\[w\.status\]\?\.color \|\| '#666'\) \+ '20', color: ORDER_STATUS\[w\.status\]\?\.color \|\| '#666' \}\}>/g,
  () => { count++; return `<StatusBadge color={ORDER_STATUS[w.status]?.color || '#666'} size="sm">`; }
);

// Pattern C: status-badge small class  
code = code.replace(
  /<span className="status-badge small" style=\{\{ backgroundColor: status\.color \+ '20', color: status\.color \}\}>/g,
  () => { count++; return '<StatusBadge color={status.color} size="sm">'; }
);

console.log('Opening tags replaced:', count);

// Now close: find each <StatusBadge...>...</span> and replace </span> with </StatusBadge>
let closeCount = 0;
code = code.replace(/(<StatusBadge[^>]*>)([\s\S]*?)<\/span>/g, (match, open, content) => {
  closeCount++;
  return open + content + '</StatusBadge>';
});
console.log('Closing tags replaced:', closeCount);

// Fix import
code = code.replace(
  "import { Button, Dialog, Input, Textarea, Select, Table, Checkbox, EntityCombobox, Spinner, Tag, ProgressBar, SearchBar, Tooltip } from '@/design-system';",
  "import { Button, Dialog, Input, Textarea, Select, Table, Checkbox, EntityCombobox, Spinner, Tag, StatusBadge, ProgressBar, SearchBar, Tooltip } from '@/design-system';"
);

fs.writeFileSync(file, code);
console.log('Done! File written.');
