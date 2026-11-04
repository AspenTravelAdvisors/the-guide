// Type declaration for components/HomeSections.jsx.
//
// It exists to stop the type checker following the import. HomeSections reads
// every atlas feed through lib/home-sections.js and lib/seo/suppliers.js, which
// import several megabytes of JSON; with allowJs + resolveJsonModule, the
// homepage (a .tsx file) importing the .jsx made `next build`'s type check
// infer types for all of it and run out of heap. A .d.ts sits ahead of .jsx in
// TypeScript's resolution order (webpack ignores it), so the checker sees this
// one line instead. The .jsx pages that import the same modules are not
// type-checked, which is why they never hit this.
export default function HomeSections(): import("react").JSX.Element;
