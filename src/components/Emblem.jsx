/**
 * The Andhra Pradesh emblem - the brand mark on every screen and every
 * printed receipt.
 *
 * Served from `public/` so the boot screen in index.html, the favicon and
 * the React app all use the same file. The receipt also carries a
 * black-and-white copy made for the 203 dpi thermal head (the colour mark's
 * yellow rays and fine gradients print as speckle); `styles/print.css` shows
 * it in place of the colour one on thermal paper.
 */
const BASE = import.meta.env.BASE_URL;
export const EMBLEM_SRC = `${BASE}ap-emblem.png`;
const EMBLEM_PRINT_SRC = `${BASE}ap-emblem-print.png`;

/** Source image is 297 x 320; `size` is the height, the width follows. */
const ASPECT = 297 / 320;

const Emblem = ({ size = 44, printable = false, className = '', title = 'Andhra Pradesh emblem' }) => {
  const width = Math.round(size * ASPECT);
  return (
    <>
      <img
        src={EMBLEM_SRC}
        alt={title}
        width={width}
        height={size}
        className={`app-emblem${className ? ` ${className}` : ''}`}
        draggable="false"
      />
      {printable && (
        <img
          src={EMBLEM_PRINT_SRC}
          alt=""
          aria-hidden="true"
          width={width}
          height={size}
          className={`app-emblem app-emblem--print${className ? ` ${className}` : ''}`}
          draggable="false"
        />
      )}
    </>
  );
};

export default Emblem;
