/* Pearson Edexcel IAL Mathematics "Mathematical Formulae and Statistical Tables" (Issue 2, January 2021), for P1–P4,
   FP1–FP3, M1–M3 and S1–S3. Copied from the booklet unit by unit, in its order and wording; only the layout is ours.
   Each item keeps a plain-text `eq` (search, fallback) beside the KaTeX `tex` the booklet modal renders. The normal, binomial and Poisson tables are computed in
   src/lib/stats.ts; the χ² and correlation tables are typed in below exactly as printed (ν = 1, 10%: 2.705). */

export const MATHS_BOOKLET_URL =
  'https://qualifications.pearson.com/content/dam/pdf/International%20Advanced%20Level/Mathematics/2018/Specification-and-Sample-Assessment/IAL-Mathematics-Formula-Book.pdf';

/** LaTeX source, written with String.raw so backslashes stay literal. */
const t = String.raw;

export interface MathsItem {
  label: string;
  /** Plain-text form: used for search and as the fallback before KaTeX loads. */
  eq: string;
  /** KaTeX source; several entries render as separate pieces that wrap independently. */
  tex: string[];
  /** KaTeX source for the label, when the label itself is maths (f(x) columns, Σ r², …). */
  ltex?: string;
}
export interface MathsSection { title: string; items: MathsItem[] }
export interface MathsUnit {
  badge: string;       // P1, FP2, S3…
  code: string;        // Pearson unit code
  title: string;
  also?: string;       // the booklet's "may also require" line
  note?: string;
  sections: MathsSection[];
}

const BINOM_1PX = t`(1+x)^n = 1 + nx + \frac{n(n-1)}{1\times 2}x^2 + \cdots + \frac{n(n-1)\cdots(n-r+1)}{1\times 2\times\cdots\times r}x^r + \cdots \quad (|x|<1,\ n\in\mathbb{R})`;

export const MATHS_UNITS: MathsUnit[] = [
  {
    badge: 'P1', code: 'WMA11', title: 'Pure Mathematics 1',
    sections: [
      { title: 'Mensuration', items: [
        { label: 'Surface area of sphere', eq: '4πr²', tex: [t`S = 4\pi r^2`] },
        { label: 'Area of curved surface of cone', eq: 'πr × slant height', tex: [t`S = \pi r \times \text{slant height}`] },
      ] },
      { title: 'Cosine rule', items: [{ label: 'Cosine rule', eq: 'a² = b² + c² − 2bc cos A', tex: [t`a^2 = b^2 + c^2 - 2bc\cos A`] }] },
    ],
  },
  {
    badge: 'P2', code: 'WMA12', title: 'Pure Mathematics 2',
    sections: [
      { title: 'Arithmetic series', items: [
        { label: 'nth term', eq: 'uₙ = a + (n − 1)d', tex: [t`u_n = a + (n-1)d`] },
        { label: 'Sum', eq: 'Sₙ = ½n(a + l) = ½n[2a + (n − 1)d]', tex: [t`S_n = \tfrac12 n(a+l) = \tfrac12 n\left[2a + (n-1)d\right]`] },
      ] },
      { title: 'Geometric series', items: [
        { label: 'nth term', eq: 'uₙ = arⁿ⁻¹', tex: [t`u_n = ar^{n-1}`] },
        { label: 'Sum', eq: 'Sₙ = a(1 − rⁿ) / (1 − r)', tex: [t`S_n = \frac{a(1-r^n)}{1-r}`] },
        { label: 'Sum to infinity', eq: 'S∞ = a / (1 − r)   for |r| < 1', tex: [t`S_\infty = \frac{a}{1-r} \quad \text{for } |r|<1`] },
      ] },
      { title: 'Logarithms and exponentials', items: [{ label: 'Change of base', eq: 'logₐ x = log_b x / log_b a', tex: [t`\log_a x = \frac{\log_b x}{\log_b a}`] }] },
      { title: 'Binomial series', items: [
        { label: '(a + b)ⁿ', eq: '(a + b)ⁿ = aⁿ + ⁿC₁ aⁿ⁻¹b + ⁿC₂ aⁿ⁻²b² + … + ⁿCᵣ aⁿ⁻ʳbʳ + … + bⁿ   (n ∈ ℕ)', ltex: t`(a+b)^n`,
          tex: [t`(a+b)^n = a^n + \binom{n}{1}a^{n-1}b + \binom{n}{2}a^{n-2}b^2 + \cdots + \binom{n}{r}a^{n-r}b^r + \cdots + b^n \quad (n\in\mathbb{N})`] },
        { label: 'ⁿCᵣ', eq: 'ⁿCᵣ = (n r) = n! / (r!(n − r)!)', ltex: t`{}^nC_r`, tex: [t`\binom{n}{r} = {}^nC_r = \frac{n!}{r!\,(n-r)!}`] },
        { label: '(1 + x)ⁿ', eq: '(1 + x)ⁿ = 1 + nx + n(n − 1)/(1×2) x² + … + n(n − 1)…(n − r + 1)/(1×2×…×r) xʳ + …   (|x| < 1, n ∈ ℝ)', ltex: t`(1+x)^n`, tex: [BINOM_1PX] },
      ] },
      { title: 'Numerical integration', items: [
        { label: 'The trapezium rule', eq: '∫ₐᵇ y dx ≈ ½h{(y₀ + yₙ) + 2(y₁ + y₂ + … + yₙ₋₁)},  where h = (b − a)/n',
          tex: [t`\int_a^b y\,dx \approx \tfrac12 h\{(y_0+y_n) + 2(y_1+y_2+\cdots+y_{n-1})\}`, t`\text{where } h = \frac{b-a}{n}`] },
      ] },
    ],
  },
  {
    badge: 'P3', code: 'WMA13', title: 'Pure Mathematics 3', also: 'P1 and P2',
    sections: [
      { title: 'Logarithms and exponentials', items: [{ label: 'aˣ', ltex: t`a^x`, eq: 'e^(x ln a) = aˣ', tex: [t`e^{x\ln a} = a^x`] }] },
      { title: 'Trigonometric identities', items: [
        { label: 'sin (A ± B)', ltex: t`\sin(A\pm B)`, eq: 'sin(A ± B) ≡ sin A cos B ± cos A sin B', tex: [t`\sin(A\pm B) \equiv \sin A\cos B \pm \cos A\sin B`] },
        { label: 'cos (A ± B)', ltex: t`\cos(A\pm B)`, eq: 'cos(A ± B) ≡ cos A cos B ∓ sin A sin B', tex: [t`\cos(A\pm B) \equiv \cos A\cos B \mp \sin A\sin B`] },
        { label: 'tan (A ± B)', ltex: t`\tan(A\pm B)`, eq: 'tan(A ± B) ≡ (tan A ± tan B) / (1 ∓ tan A tan B)   (A ± B ≠ (k + ½)π)',
          tex: [t`\tan(A\pm B) \equiv \frac{\tan A \pm \tan B}{1 \mp \tan A\tan B}`, t`\left(A\pm B \neq (k+\tfrac12)\pi\right)`] },
        { label: 'sin A + sin B', ltex: t`\sin A + \sin B`, eq: 'sin A + sin B ≡ 2 sin ½(A + B) cos ½(A − B)', tex: [t`\sin A + \sin B \equiv 2\sin\frac{A+B}{2}\cos\frac{A-B}{2}`] },
        { label: 'sin A − sin B', ltex: t`\sin A - \sin B`, eq: 'sin A − sin B ≡ 2 cos ½(A + B) sin ½(A − B)', tex: [t`\sin A - \sin B \equiv 2\cos\frac{A+B}{2}\sin\frac{A-B}{2}`] },
        { label: 'cos A + cos B', ltex: t`\cos A + \cos B`, eq: 'cos A + cos B ≡ 2 cos ½(A + B) cos ½(A − B)', tex: [t`\cos A + \cos B \equiv 2\cos\frac{A+B}{2}\cos\frac{A-B}{2}`] },
        { label: 'cos A − cos B', ltex: t`\cos A - \cos B`, eq: 'cos A − cos B ≡ −2 sin ½(A + B) sin ½(A − B)', tex: [t`\cos A - \cos B \equiv -2\sin\frac{A+B}{2}\sin\frac{A-B}{2}`] },
      ] },
      { title: 'Differentiation: f(x) → f′(x)', items: [
        { label: 'tan kx', ltex: t`\tan kx`, eq: 'k sec² kx', tex: [t`k\sec^2 kx`] },
        { label: 'sec x', ltex: t`\sec x`, eq: 'sec x tan x', tex: [t`\sec x\tan x`] },
        { label: 'cot x', ltex: t`\cot x`, eq: '−cosec² x', tex: [t`-\operatorname{cosec}^2 x`] },
        { label: 'cosec x', ltex: t`\operatorname{cosec} x`, eq: '−cosec x cot x', tex: [t`-\operatorname{cosec} x\cot x`] },
        { label: 'f(x) / g(x)', ltex: t`\dfrac{f(x)}{g(x)}`, eq: '(f′(x)g(x) − f(x)g′(x)) / (g(x))²', tex: [t`\frac{f'(x)g(x) - f(x)g'(x)}{\left(g(x)\right)^2}`] },
      ] },
      { title: 'Integration (+ constant): f(x) → ∫ f(x) dx', items: [
        { label: 'sec² kx', ltex: t`\sec^2 kx`, eq: '(1/k) tan kx', tex: [t`\frac1k\tan kx`] },
        { label: 'tan x', ltex: t`\tan x`, eq: 'ln |sec x|', tex: [t`\ln|\sec x|`] },
        { label: 'cot x', ltex: t`\cot x`, eq: 'ln |sin x|', tex: [t`\ln|\sin x|`] },
      ] },
    ],
  },
  {
    badge: 'P4', code: 'WMA14', title: 'Pure Mathematics 4', also: 'P1, P2 and P3',
    sections: [
      { title: 'Binomial series', items: [
        { label: '(1 + x)ⁿ', ltex: t`(1+x)^n`, eq: '(1 + x)ⁿ = 1 + nx + n(n − 1)/(1×2) x² + … + n(n − 1)…(n − r + 1)/(1×2×…×r) xʳ + …   (|x| < 1, n ∈ ℝ)', tex: [BINOM_1PX] },
      ] },
      { title: 'Integration (+ constant): f(x) → ∫ f(x) dx', items: [
        { label: 'cosec x', ltex: t`\operatorname{cosec} x`, eq: '−ln |cosec x + cot x|,   ln |tan ½x|', tex: [t`-\ln|\operatorname{cosec} x + \cot x|,`, t`\ln\left|\tan\tfrac12 x\right|`] },
        { label: 'sec x', ltex: t`\sec x`, eq: 'ln |sec x + tan x|,   ln |tan(½x + ¼π)|', tex: [t`\ln|\sec x + \tan x|,`, t`\ln\left|\tan\left(\tfrac12 x + \tfrac14\pi\right)\right|`] },
        { label: 'By parts', eq: '∫ u (dv/dx) dx = uv − ∫ v (du/dx) dx', tex: [t`\int u\frac{dv}{dx}\,dx = uv - \int v\frac{du}{dx}\,dx`] },
      ] },
    ],
  },
  {
    badge: 'FP1', code: 'WFM01', title: 'Further Pure Mathematics 1', also: 'P1 and P2',
    sections: [
      { title: 'Summations', items: [
        { label: 'Σ r²', ltex: t`\sum r^2`, eq: 'Σᵣ₌₁ⁿ r² = ⅙n(n + 1)(2n + 1)', tex: [t`\sum_{r=1}^{n} r^2 = \tfrac16 n(n+1)(2n+1)`] },
        { label: 'Σ r³', ltex: t`\sum r^3`, eq: 'Σᵣ₌₁ⁿ r³ = ¼n²(n + 1)²', tex: [t`\sum_{r=1}^{n} r^3 = \tfrac14 n^2(n+1)^2`] },
      ] },
      { title: 'Numerical solution of equations', items: [
        { label: 'Newton–Raphson for f(x) = 0', eq: 'xₙ₊₁ = xₙ − f(xₙ) / f′(xₙ)', tex: [t`x_{n+1} = x_n - \frac{f(x_n)}{f'(x_n)}`] },
      ] },
      { title: 'Conics', items: [
        { label: 'Parabola', eq: 'y² = 4ax  ·  parametric (at², 2at)  ·  focus (a, 0)  ·  directrix x = −a',
          tex: [t`y^2 = 4ax`, t`\text{parametric } (at^2,\ 2at)`, t`\text{focus } (a,0)`, t`\text{directrix } x = -a`] },
        { label: 'Rectangular hyperbola', eq: 'xy = c²  ·  parametric (ct, c/t)  ·  foci and directrices not required',
          tex: [t`xy = c^2`, t`\text{parametric } \left(ct,\ \tfrac{c}{t}\right)`, t`\text{foci and directrices not required}`] },
      ] },
      { title: 'Matrix transformations', items: [
        { label: 'Anticlockwise rotation through θ about O', eq: '( cos θ   −sin θ ;  sin θ   cos θ )', tex: [t`\begin{pmatrix} \cos\theta & -\sin\theta \\ \sin\theta & \cos\theta \end{pmatrix}`] },
        { label: 'Reflection in the line y = (tan θ)x', eq: '( cos 2θ   sin 2θ ;  sin 2θ   −cos 2θ )', tex: [t`\begin{pmatrix} \cos 2\theta & \sin 2\theta \\ \sin 2\theta & -\cos 2\theta \end{pmatrix}`] },
      ] },
    ],
  },
  {
    badge: 'FP2', code: 'WFM02', title: 'Further Pure Mathematics 2', also: 'FP1, and P1, P2, P3 and P4',
    sections: [
      { title: 'Area of a sector', items: [{ label: 'Polar coordinates', eq: 'A = ½ ∫ r² dθ', tex: [t`A = \frac12\int r^2\,d\theta`] }] },
      { title: 'Complex numbers', items: [
        { label: 'Euler', eq: 'e^(iθ) = cos θ + i sin θ', tex: [t`e^{i\theta} = \cos\theta + i\sin\theta`] },
        { label: 'de Moivre', eq: '{r(cos θ + i sin θ)}ⁿ = rⁿ(cos nθ + i sin nθ)', tex: [t`\{r(\cos\theta + i\sin\theta)\}^n = r^n(\cos n\theta + i\sin n\theta)`] },
        { label: 'Roots of zⁿ = 1', eq: 'z = e^(2πki/n),  for k = 0, 1, 2, …, n − 1', tex: [t`z = e^{\frac{2\pi k i}{n}},`, t`\text{for } k = 0, 1, 2, \ldots, n-1`] },
      ] },
      { title: 'Maclaurin’s and Taylor’s series', items: [
        { label: 'Maclaurin', eq: 'f(x) = f(0) + x f′(0) + x²/2! f″(0) + … + xʳ/r! f⁽ʳ⁾(0) + …', tex: [t`f(x) = f(0) + xf'(0) + \frac{x^2}{2!}f''(0) + \cdots + \frac{x^r}{r!}f^{(r)}(0) + \cdots`] },
        { label: 'Taylor about a', eq: 'f(x) = f(a) + (x − a) f′(a) + (x − a)²/2! f″(a) + … + (x − a)ʳ/r! f⁽ʳ⁾(a) + …', tex: [t`f(x) = f(a) + (x-a)f'(a) + \frac{(x-a)^2}{2!}f''(a) + \cdots + \frac{(x-a)^r}{r!}f^{(r)}(a) + \cdots`] },
        { label: 'Taylor, f(a + x)', eq: 'f(a + x) = f(a) + x f′(a) + x²/2! f″(a) + … + xʳ/r! f⁽ʳ⁾(a) + …', tex: [t`f(a+x) = f(a) + xf'(a) + \frac{x^2}{2!}f''(a) + \cdots + \frac{x^r}{r!}f^{(r)}(a) + \cdots`] },
        { label: 'eˣ', ltex: t`e^x`, eq: 'eˣ = exp(x) = 1 + x + x²/2! + … + xʳ/r! + …   for all x', tex: [t`e^x = \exp(x) = 1 + x + \frac{x^2}{2!} + \cdots + \frac{x^r}{r!} + \cdots`, t`\text{for all } x`] },
        { label: 'ln(1 + x)', ltex: t`\ln(1+x)`, eq: 'ln(1 + x) = x − x²/2 + x³/3 − … + (−1)ʳ⁺¹ xʳ/r + …   (−1 < x ≤ 1)', tex: [t`\ln(1+x) = x - \frac{x^2}{2} + \frac{x^3}{3} - \cdots + (-1)^{r+1}\frac{x^r}{r} + \cdots`, t`(-1 < x \leq 1)`] },
        { label: 'sin x', ltex: t`\sin x`, eq: 'sin x = x − x³/3! + x⁵/5! − … + (−1)ʳ x²ʳ⁺¹/(2r + 1)! + …   for all x', tex: [t`\sin x = x - \frac{x^3}{3!} + \frac{x^5}{5!} - \cdots + (-1)^r\frac{x^{2r+1}}{(2r+1)!} + \cdots`, t`\text{for all } x`] },
        { label: 'cos x', ltex: t`\cos x`, eq: 'cos x = 1 − x²/2! + x⁴/4! − … + (−1)ʳ x²ʳ/(2r)! + …   for all x', tex: [t`\cos x = 1 - \frac{x^2}{2!} + \frac{x^4}{4!} - \cdots + (-1)^r\frac{x^{2r}}{(2r)!} + \cdots`, t`\text{for all } x`] },
        { label: 'arctan x', ltex: t`\arctan x`, eq: 'arctan x = x − x³/3 + x⁵/5 − … + (−1)ʳ x²ʳ⁺¹/(2r + 1) + …   (−1 ≤ x ≤ 1)', tex: [t`\arctan x = x - \frac{x^3}{3} + \frac{x^5}{5} - \cdots + (-1)^r\frac{x^{2r+1}}{2r+1} + \cdots`, t`(-1 \leq x \leq 1)`] },
      ] },
    ],
  },
  {
    badge: 'FP3', code: 'WFM03', title: 'Further Pure Mathematics 3', also: 'FP1, and P1, P2, P3 and P4',
    sections: [
      { title: 'Vectors', items: [
        { label: 'Resolved part of a in the direction of b', eq: 'a.b / |b|', tex: [t`\frac{\mathbf{a}\cdot\mathbf{b}}{|\mathbf{b}|}`] },
        { label: 'Point dividing AB in the ratio λ : μ', eq: '(μa + λb) / (λ + μ)', tex: [t`\frac{\mu\mathbf{a} + \lambda\mathbf{b}}{\lambda + \mu}`] },
        { label: 'Vector product', eq: 'a × b = |a||b| sin θ n̂ = | i  j  k ; a₁  a₂  a₃ ; b₁  b₂  b₃ | = (a₂b₃ − a₃b₂, a₃b₁ − a₁b₃, a₁b₂ − a₂b₁)',
          tex: [t`\mathbf{a}\times\mathbf{b} = |\mathbf{a}||\mathbf{b}|\sin\theta\,\hat{\mathbf{n}} = \begin{vmatrix} \mathbf{i} & \mathbf{j} & \mathbf{k} \\ a_1 & a_2 & a_3 \\ b_1 & b_2 & b_3 \end{vmatrix}`, t`= \begin{pmatrix} a_2b_3 - a_3b_2 \\ a_3b_1 - a_1b_3 \\ a_1b_2 - a_2b_1 \end{pmatrix}`] },
        { label: 'Scalar triple product', eq: 'a.(b × c) = | a₁ a₂ a₃ ; b₁ b₂ b₃ ; c₁ c₂ c₃ | = b.(c × a) = c.(a × b)',
          tex: [t`\mathbf{a}\cdot(\mathbf{b}\times\mathbf{c}) = \begin{vmatrix} a_1 & a_2 & a_3 \\ b_1 & b_2 & b_3 \\ c_1 & c_2 & c_3 \end{vmatrix}`, t`= \mathbf{b}\cdot(\mathbf{c}\times\mathbf{a}) = \mathbf{c}\cdot(\mathbf{a}\times\mathbf{b})`] },
        { label: 'Line through A with direction b', eq: '(x − a₁)/b₁ = (y − a₂)/b₂ = (z − a₃)/b₃  (= λ)', tex: [t`\frac{x-a_1}{b_1} = \frac{y-a_2}{b_2} = \frac{z-a_3}{b_3} \ (=\lambda)`] },
        { label: 'Plane through A with normal n', eq: 'n₁x + n₂y + n₃z + d = 0,  where d = −a.n', tex: [t`n_1x + n_2y + n_3z + d = 0,`, t`\text{where } d = -\mathbf{a}\cdot\mathbf{n}`] },
        { label: 'Plane through non-collinear A, B, C', eq: 'r = a + λ(b − a) + μ(c − a) = (1 − λ − μ)a + λb + μc', tex: [t`\mathbf{r} = \mathbf{a} + \lambda(\mathbf{b}-\mathbf{a}) + \mu(\mathbf{c}-\mathbf{a})`, t`= (1-\lambda-\mu)\mathbf{a} + \lambda\mathbf{b} + \mu\mathbf{c}`] },
        { label: 'Plane through a, parallel to b and c', eq: 'r = a + sb + tc', tex: [t`\mathbf{r} = \mathbf{a} + s\mathbf{b} + t\mathbf{c}`] },
        { label: 'Distance of (α, β, γ) from n₁x + n₂y + n₃z + d = 0', eq: '|n₁α + n₂β + n₃γ + d| / √(n₁² + n₂² + n₃²)', tex: [t`\frac{|n_1\alpha + n_2\beta + n_3\gamma + d|}{\sqrt{n_1^2 + n_2^2 + n_3^2}}`] },
      ] },
      { title: 'Hyperbolic functions', items: [
        { label: 'Identity', eq: 'cosh² x − sinh² x ≡ 1', tex: [t`\cosh^2 x - \sinh^2 x \equiv 1`] },
        { label: 'sinh 2x', ltex: t`\sinh 2x`, eq: 'sinh 2x ≡ 2 sinh x cosh x', tex: [t`\sinh 2x \equiv 2\sinh x\cosh x`] },
        { label: 'cosh 2x', ltex: t`\cosh 2x`, eq: 'cosh 2x ≡ cosh² x + sinh² x', tex: [t`\cosh 2x \equiv \cosh^2 x + \sinh^2 x`] },
        { label: 'arcosh x', ltex: t`\operatorname{arcosh} x`, eq: 'arcosh x ≡ ln{x + √(x² − 1)}   (x ≥ 1)', tex: [t`\operatorname{arcosh} x \equiv \ln\left\{x + \sqrt{x^2-1}\right\} \quad (x \geq 1)`] },
        { label: 'arsinh x', ltex: t`\operatorname{arsinh} x`, eq: 'arsinh x ≡ ln{x + √(x² + 1)}', tex: [t`\operatorname{arsinh} x \equiv \ln\left\{x + \sqrt{x^2+1}\right\}`] },
        { label: 'artanh x', ltex: t`\operatorname{artanh} x`, eq: 'artanh x ≡ ½ ln((1 + x)/(1 − x))   (|x| < 1)', tex: [t`\operatorname{artanh} x \equiv \frac12\ln\left(\frac{1+x}{1-x}\right) \quad (|x|<1)`] },
      ] },
      { title: 'Conics', items: [
        { label: 'Ellipse', eq: 'x²/a² + y²/b² = 1  ·  (a cos θ, b sin θ)  ·  e < 1, b² = a²(1 − e²)  ·  foci (±ae, 0)  ·  directrices x = ±a/e  ·  no asymptotes',
          tex: [t`\frac{x^2}{a^2} + \frac{y^2}{b^2} = 1`, t`(a\cos\theta,\ b\sin\theta)`, t`e<1,\ b^2 = a^2(1-e^2)`, t`\text{foci } (\pm ae, 0)`, t`\text{directrices } x = \pm\frac{a}{e}`, t`\text{no asymptotes}`] },
        { label: 'Parabola', eq: 'y² = 4ax  ·  (at², 2at)  ·  e = 1  ·  focus (a, 0)  ·  directrix x = −a  ·  no asymptotes',
          tex: [t`y^2 = 4ax`, t`(at^2,\ 2at)`, t`e = 1`, t`\text{focus } (a,0)`, t`\text{directrix } x = -a`, t`\text{no asymptotes}`] },
        { label: 'Hyperbola', eq: 'x²/a² − y²/b² = 1  ·  (a sec θ, b tan θ) or (±a cosh θ, b sinh θ)  ·  e > 1, b² = a²(e² − 1)  ·  foci (±ae, 0)  ·  directrices x = ±a/e  ·  asymptotes x/a = ±y/b',
          tex: [t`\frac{x^2}{a^2} - \frac{y^2}{b^2} = 1`, t`(a\sec\theta,\ b\tan\theta) \text{ or } (\pm a\cosh\theta,\ b\sinh\theta)`, t`e>1,\ b^2 = a^2(e^2-1)`, t`\text{foci } (\pm ae, 0)`, t`\text{directrices } x = \pm\frac{a}{e}`, t`\text{asymptotes } \frac{x}{a} = \pm\frac{y}{b}`] },
        { label: 'Rectangular hyperbola', eq: 'xy = c²  ·  (ct, c/t)  ·  e = √2  ·  foci (±√2 c, ±√2 c)  ·  directrices x + y = ±√2 c  ·  asymptotes x = 0, y = 0',
          tex: [t`xy = c^2`, t`\left(ct,\ \tfrac{c}{t}\right)`, t`e = \sqrt2`, t`\text{foci } (\pm\sqrt2\,c,\ \pm\sqrt2\,c)`, t`\text{directrices } x + y = \pm\sqrt2\,c`, t`\text{asymptotes } x = 0,\ y = 0`] },
      ] },
      { title: 'Differentiation: f(x) → f′(x)', items: [
        { label: 'arcsin x', ltex: t`\arcsin x`, eq: '1 / √(1 − x²)', tex: [t`\frac{1}{\sqrt{1-x^2}}`] },
        { label: 'arccos x', ltex: t`\arccos x`, eq: '−1 / √(1 − x²)', tex: [t`-\frac{1}{\sqrt{1-x^2}}`] },
        { label: 'arctan x', ltex: t`\arctan x`, eq: '1 / (1 + x²)', tex: [t`\frac{1}{1+x^2}`] },
        { label: 'sinh x', ltex: t`\sinh x`, eq: 'cosh x', tex: [t`\cosh x`] },
        { label: 'cosh x', ltex: t`\cosh x`, eq: 'sinh x', tex: [t`\sinh x`] },
        { label: 'tanh x', ltex: t`\tanh x`, eq: 'sech² x', tex: [t`\operatorname{sech}^2 x`] },
        { label: 'arsinh x', ltex: t`\operatorname{arsinh} x`, eq: '1 / √(1 + x²)', tex: [t`\frac{1}{\sqrt{1+x^2}}`] },
        { label: 'arcosh x', ltex: t`\operatorname{arcosh} x`, eq: '1 / √(x² − 1)', tex: [t`\frac{1}{\sqrt{x^2-1}}`] },
        { label: 'artanh x', ltex: t`\operatorname{artanh} x`, eq: '1 / (1 − x²)', tex: [t`\frac{1}{1-x^2}`] },
      ] },
      { title: 'Integration (+ constant; a > 0 where relevant): f(x) → ∫ f(x) dx', items: [
        { label: 'sinh x', ltex: t`\sinh x`, eq: 'cosh x', tex: [t`\cosh x`] },
        { label: 'cosh x', ltex: t`\cosh x`, eq: 'sinh x', tex: [t`\sinh x`] },
        { label: 'tanh x', ltex: t`\tanh x`, eq: 'ln cosh x', tex: [t`\ln\cosh x`] },
        { label: '1 / √(a² − x²)', ltex: t`\dfrac{1}{\sqrt{a^2-x^2}}`, eq: 'arcsin(x/a)   (|x| < a)', tex: [t`\arcsin\left(\frac{x}{a}\right) \quad (|x|<a)`] },
        { label: '1 / (a² + x²)', ltex: t`\dfrac{1}{a^2+x^2}`, eq: '(1/a) arctan(x/a)', tex: [t`\frac1a\arctan\left(\frac{x}{a}\right)`] },
        { label: '1 / √(x² − a²)', ltex: t`\dfrac{1}{\sqrt{x^2-a^2}}`, eq: 'arcosh(x/a),   ln{x + √(x² − a²)}   (x > a)', tex: [t`\operatorname{arcosh}\left(\frac{x}{a}\right),`, t`\ln\left\{x + \sqrt{x^2-a^2}\right\} \quad (x>a)`] },
        { label: '1 / √(a² + x²)', ltex: t`\dfrac{1}{\sqrt{a^2+x^2}}`, eq: 'arsinh(x/a),   ln{x + √(x² + a²)}', tex: [t`\operatorname{arsinh}\left(\frac{x}{a}\right),`, t`\ln\left\{x + \sqrt{x^2+a^2}\right\}`] },
        { label: '1 / (a² − x²)', ltex: t`\dfrac{1}{a^2-x^2}`, eq: '(1/2a) ln((a + x)/(a − x)) = (1/a) artanh(x/a)   (|x| < a)', tex: [t`\frac{1}{2a}\ln\left(\frac{a+x}{a-x}\right) = \frac1a\operatorname{artanh}\left(\frac{x}{a}\right) \quad (|x|<a)`] },
        { label: '1 / (x² − a²)', ltex: t`\dfrac{1}{x^2-a^2}`, eq: '(1/2a) ln((x − a)/(x + a))', tex: [t`\frac{1}{2a}\ln\left(\frac{x-a}{x+a}\right)`] },
      ] },
      { title: 'Arc length', items: [
        { label: 'Cartesian coordinates', eq: 's = ∫ √(1 + (dy/dx)²) dx', tex: [t`s = \int\sqrt{1 + \left(\frac{dy}{dx}\right)^2}\,dx`] },
        { label: 'Parametric form', eq: 's = ∫ √((dx/dt)² + (dy/dt)²) dt', tex: [t`s = \int\sqrt{\left(\frac{dx}{dt}\right)^2 + \left(\frac{dy}{dt}\right)^2}\,dt`] },
      ] },
      { title: 'Surface area of revolution', items: [
        { label: 'About the x-axis', eq: 'Sₓ = 2π ∫ y ds = 2π ∫ y √(1 + (dy/dx)²) dx = 2π ∫ y √((dx/dt)² + (dy/dt)²) dt',
          tex: [t`S_x = 2\pi\int y\,ds = 2\pi\int y\sqrt{1 + \left(\frac{dy}{dx}\right)^2}\,dx`, t`= 2\pi\int y\sqrt{\left(\frac{dx}{dt}\right)^2 + \left(\frac{dy}{dt}\right)^2}\,dt`] },
      ] },
    ],
  },
  {
    badge: 'M1', code: 'WME01', title: 'Mechanics 1', also: 'P1 and P2',
    note: 'There are no formulae given for M1 in addition to those candidates are expected to know.',
    sections: [],
  },
  {
    badge: 'M2', code: 'WME02', title: 'Mechanics 2', also: 'P1, P2, P3 and P4',
    sections: [
      { title: 'Centres of mass (uniform bodies)', items: [
        { label: 'Triangular lamina', eq: '⅔ along median from vertex', tex: [t`\tfrac23 \text{ along median from vertex}`] },
        { label: 'Circular arc, radius r, angle at centre 2α', eq: '(r sin α) / α from centre', tex: [t`\frac{r\sin\alpha}{\alpha} \text{ from centre}`] },
        { label: 'Sector of circle, radius r, angle at centre 2α', eq: '(2r sin α) / (3α) from centre', tex: [t`\frac{2r\sin\alpha}{3\alpha} \text{ from centre}`] },
      ] },
    ],
  },
  {
    badge: 'M3', code: 'WME03', title: 'Mechanics 3', also: 'M2, and P1, P2, P3 and P4',
    sections: [
      { title: 'Motion in a circle', items: [
        { label: 'Transverse velocity', eq: 'v = rθ̇', tex: [t`v = r\dot\theta`] },
        { label: 'Transverse acceleration', eq: 'v̇ = rθ̈', tex: [t`\dot v = r\ddot\theta`] },
        { label: 'Radial acceleration', eq: '−rθ̇² = −v²/r', tex: [t`-r\dot\theta^2 = -\frac{v^2}{r}`] },
      ] },
      { title: 'Centres of mass (uniform bodies)', items: [
        { label: 'Solid hemisphere, radius r', eq: '⅜r from centre', tex: [t`\tfrac38 r \text{ from centre}`] },
        { label: 'Hemispherical shell, radius r', eq: '½r from centre', tex: [t`\tfrac12 r \text{ from centre}`] },
        { label: 'Solid cone or pyramid of height h', eq: '¼h above the base on the line from centre of base to vertex', tex: [t`\tfrac14 h \text{ above the base}`, t`\text{on the line from centre}`, t`\text{of base to vertex}`] },
        { label: 'Conical shell of height h', eq: '⅓h above the base on the line from centre of base to vertex', tex: [t`\tfrac13 h \text{ above the base}`, t`\text{on the line from centre}`, t`\text{of base to vertex}`] },
      ] },
      { title: 'Universal law of gravitation', items: [{ label: 'Force', eq: 'F = Gm₁m₂ / d²', tex: [t`F = \frac{Gm_1m_2}{d^2}`] }] },
    ],
  },
  {
    badge: 'S1', code: 'WST01', title: 'Statistics 1', also: 'P1 and P2',
    sections: [
      { title: 'Probability', items: [
        { label: 'Addition', eq: 'P(A ∪ B) = P(A) + P(B) − P(A ∩ B)', tex: [t`P(A\cup B) = P(A) + P(B) - P(A\cap B)`] },
        { label: 'Multiplication', eq: 'P(A ∩ B) = P(A) P(B | A)', tex: [t`P(A\cap B) = P(A)\,P(B\mid A)`] },
        { label: 'Bayes', eq: 'P(A | B) = P(B | A) P(A) / [P(B | A) P(A) + P(B | A′) P(A′)]', tex: [t`P(A\mid B) = \frac{P(B\mid A)\,P(A)}{P(B\mid A)\,P(A) + P(B\mid A')\,P(A')}`] },
      ] },
      { title: 'Discrete distributions', items: [
        { label: 'Expectation (mean)', eq: 'E(X) = μ = Σ xᵢ P(X = xᵢ)', tex: [t`E(X) = \mu = \sum x_i\,P(X = x_i)`] },
        { label: 'Variance', eq: 'Var(X) = σ² = Σ (xᵢ − μ)² P(X = xᵢ) = Σ xᵢ² P(X = xᵢ) − μ²', tex: [t`\operatorname{Var}(X) = \sigma^2 = \sum (x_i-\mu)^2\,P(X = x_i)`, t`= \sum x_i^2\,P(X = x_i) - \mu^2`] },
        { label: 'For a function g(X)', eq: 'E(g(X)) = Σ g(xᵢ) P(X = xᵢ)', tex: [t`E(g(X)) = \sum g(x_i)\,P(X = x_i)`] },
      ] },
      { title: 'Continuous distributions', items: [
        { label: 'Normal N(μ, σ²)', eq: 'p.d.f. (1 / (σ√(2π))) e^(−½((x − μ)/σ)²)  ·  mean μ  ·  variance σ²',
          tex: [t`f(x) = \frac{1}{\sigma\sqrt{2\pi}}\,e^{-\frac12\left(\frac{x-\mu}{\sigma}\right)^2}`, t`\text{mean } \mu`, t`\text{variance } \sigma^2`] },
      ] },
      { title: 'Correlation and regression (n pairs (xᵢ, yᵢ))', items: [
        { label: 'Sₓₓ', ltex: t`S_{xx}`, eq: 'Sₓₓ = Σ(xᵢ − x̄)² = Σ xᵢ² − (Σ xᵢ)²/n', tex: [t`S_{xx} = \sum(x_i-\bar x)^2 = \sum x_i^2 - \frac{\left(\sum x_i\right)^2}{n}`] },
        { label: 'Sᵧᵧ', ltex: t`S_{yy}`, eq: 'Sᵧᵧ = Σ(yᵢ − ȳ)² = Σ yᵢ² − (Σ yᵢ)²/n', tex: [t`S_{yy} = \sum(y_i-\bar y)^2 = \sum y_i^2 - \frac{\left(\sum y_i\right)^2}{n}`] },
        { label: 'Sₓᵧ', ltex: t`S_{xy}`, eq: 'Sₓᵧ = Σ(xᵢ − x̄)(yᵢ − ȳ) = Σ xᵢyᵢ − (Σ xᵢ)(Σ yᵢ)/n', tex: [t`S_{xy} = \sum(x_i-\bar x)(y_i-\bar y) = \sum x_iy_i - \frac{\left(\sum x_i\right)\left(\sum y_i\right)}{n}`] },
        { label: 'Product moment correlation coefficient', eq: 'r = Sₓᵧ / √(Sₓₓ Sᵧᵧ) = Σ(xᵢ − x̄)(yᵢ − ȳ) / √{Σ(xᵢ − x̄)² Σ(yᵢ − ȳ)²}',
          tex: [t`r = \frac{S_{xy}}{\sqrt{S_{xx}S_{yy}}} = \frac{\sum(x_i-\bar x)(y_i-\bar y)}{\sqrt{\left\{\sum(x_i-\bar x)^2\right\}\left\{\sum(y_i-\bar y)^2\right\}}}`] },
        { label: 'Regression coefficient of y on x', eq: 'b = Sₓᵧ / Sₓₓ = Σ(xᵢ − x̄)(yᵢ − ȳ) / Σ(xᵢ − x̄)²', tex: [t`b = \frac{S_{xy}}{S_{xx}} = \frac{\sum(x_i-\bar x)(y_i-\bar y)}{\sum(x_i-\bar x)^2}`] },
        { label: 'Least squares regression line of y on x', eq: 'y = a + bx,  where a = ȳ − bx̄', tex: [t`y = a + bx,`, t`\text{where } a = \bar y - b\bar x`] },
      ] },
    ],
  },
  {
    badge: 'S2', code: 'WST02', title: 'Statistics 2', also: 'S1, and P1, P2, P3 and P4',
    sections: [
      { title: 'Discrete distributions', items: [
        { label: 'Binomial B(n, p)', eq: 'P(X = x) = (n x) pˣ(1 − p)ⁿ⁻ˣ  ·  mean np  ·  variance np(1 − p)', tex: [t`P(X = x) = \binom{n}{x}p^x(1-p)^{n-x}`, t`\text{mean } np`, t`\text{variance } np(1-p)`] },
        { label: 'Poisson Po(λ)', eq: 'P(X = x) = e^(−λ) λˣ / x!  ·  mean λ  ·  variance λ', tex: [t`P(X = x) = e^{-\lambda}\frac{\lambda^x}{x!}`, t`\text{mean } \lambda`, t`\text{variance } \lambda`] },
      ] },
      { title: 'Continuous distributions (p.d.f. f)', items: [
        { label: 'Expectation (mean)', eq: 'E(X) = μ = ∫ x f(x) dx', tex: [t`E(X) = \mu = \int x\,f(x)\,dx`] },
        { label: 'Variance', eq: 'Var(X) = σ² = ∫ (x − μ)² f(x) dx = ∫ x² f(x) dx − μ²', tex: [t`\operatorname{Var}(X) = \sigma^2 = \int (x-\mu)^2 f(x)\,dx = \int x^2 f(x)\,dx - \mu^2`] },
        { label: 'For a function g(X)', eq: 'E(g(X)) = ∫ g(x) f(x) dx', tex: [t`E(g(X)) = \int g(x)\,f(x)\,dx`] },
        { label: 'Cumulative distribution function', eq: 'F(x₀) = P(X ≤ x₀) = ∫₋∞^x₀ f(t) dt', tex: [t`F(x_0) = P(X \leq x_0) = \int_{-\infty}^{x_0} f(t)\,dt`] },
        { label: 'Uniform (rectangular) on [a, b]', eq: 'p.d.f. 1/(b − a)  ·  mean ½(a + b)  ·  variance (b − a)²/12', tex: [t`f(x) = \frac{1}{b-a}`, t`\text{mean } \tfrac12(a+b)`, t`\text{variance } \frac{(b-a)^2}{12}`] },
      ] },
    ],
  },
  {
    badge: 'S3', code: 'WST03', title: 'Statistics 3', also: 'S1 and S2, and P1, P2, P3 and P4',
    sections: [
      { title: 'Expectation algebra (X, Y independent)', items: [
        { label: 'E(XY)', ltex: t`E(XY)`, eq: 'E(XY) = E(X) E(Y)', tex: [t`E(XY) = E(X)\,E(Y)`] },
        { label: 'Var(aX ± bY)', ltex: t`\operatorname{Var}(aX\pm bY)`, eq: 'Var(aX ± bY) = a² Var(X) + b² Var(Y)', tex: [t`\operatorname{Var}(aX\pm bY) = a^2\operatorname{Var}(X) + b^2\operatorname{Var}(Y)`] },
      ] },
      { title: 'Sampling distributions', items: [
        { label: 'X̄ (sample of n, mean μ, variance σ²)', eq: 'X̄ is an unbiased estimator of μ, with Var(X̄) = σ²/n', tex: [t`\bar X \text{ is an unbiased estimator of } \mu,`, t`\operatorname{Var}(\bar X) = \frac{\sigma^2}{n}`] },
        { label: 'S²', ltex: t`S^2`, eq: 'S² is an unbiased estimator of σ², where S² = Σ(Xᵢ − X̄)² / (n − 1)', tex: [t`S^2 \text{ is an unbiased estimator of } \sigma^2,`, t`S^2 = \frac{\sum(X_i-\bar X)^2}{n-1}`] },
        { label: 'Sample of n from N(μ, σ²)', eq: '(X̄ − μ) / (σ/√n) ∼ N(0, 1)', tex: [t`\frac{\bar X - \mu}{\sigma/\sqrt n} \sim N(0, 1)`] },
        { label: 'Two independent samples from N(μₓ, σₓ²), N(μᵧ, σᵧ²)', eq: '((X̄ − Ȳ) − (μₓ − μᵧ)) / √(σₓ²/nₓ + σᵧ²/nᵧ) ∼ N(0, 1)', tex: [t`\frac{(\bar X - \bar Y) - (\mu_x - \mu_y)}{\sqrt{\dfrac{\sigma_x^2}{n_x} + \dfrac{\sigma_y^2}{n_y}}} \sim N(0, 1)`] },
      ] },
      { title: 'Correlation and regression', items: [
        { label: 'Spearman’s rank correlation coefficient', eq: 'rₛ = 1 − 6Σd² / (n(n² − 1))', tex: [t`r_s = 1 - \frac{6\sum d^2}{n(n^2-1)}`] },
      ] },
      { title: 'Non-parametric tests', items: [
        { label: 'Goodness-of-fit and contingency tables', eq: 'Σ (Oᵢ − Eᵢ)² / Eᵢ ∼ χ²_ν', tex: [t`\sum\frac{(O_i - E_i)^2}{E_i} \sim \chi^2_\nu`] },
      ] },
    ],
  },
  {
    badge: 'D1', code: 'WDM11', title: 'Decision Mathematics 1',
    note: 'No formulae are required for D1.',
    sections: [],
  },
];

export const CHI_P = ['0.995', '0.990', '0.975', '0.950', '0.900', '0.100', '0.050', '0.025', '0.010', '0.005'];
/** χ² percentage points, ν = 1…30: the value exceeded with each probability in CHI_P. */
export const CHI2: string[][] = [
  ['0.000', '0.000', '0.001', '0.004', '0.016', '2.705', '3.841', '5.024', '6.635', '7.879'],
  ['0.010', '0.020', '0.051', '0.103', '0.211', '4.605', '5.991', '7.378', '9.210', '10.597'],
  ['0.072', '0.115', '0.216', '0.352', '0.584', '6.251', '7.815', '9.348', '11.345', '12.838'],
  ['0.207', '0.297', '0.484', '0.711', '1.064', '7.779', '9.488', '11.143', '13.277', '14.860'],
  ['0.412', '0.554', '0.831', '1.145', '1.610', '9.236', '11.070', '12.832', '15.086', '16.750'],
  ['0.676', '0.872', '1.237', '1.635', '2.204', '10.645', '12.592', '14.449', '16.812', '18.548'],
  ['0.989', '1.239', '1.690', '2.167', '2.833', '12.017', '14.067', '16.013', '18.475', '20.278'],
  ['1.344', '1.646', '2.180', '2.733', '3.490', '13.362', '15.507', '17.535', '20.090', '21.955'],
  ['1.735', '2.088', '2.700', '3.325', '4.168', '14.684', '16.919', '19.023', '21.666', '23.589'],
  ['2.156', '2.558', '3.247', '3.940', '4.865', '15.987', '18.307', '20.483', '23.209', '25.188'],
  ['2.603', '3.053', '3.816', '4.575', '5.580', '17.275', '19.675', '21.920', '24.725', '26.757'],
  ['3.074', '3.571', '4.404', '5.226', '6.304', '18.549', '21.026', '23.337', '26.217', '28.300'],
  ['3.565', '4.107', '5.009', '5.892', '7.042', '19.812', '22.362', '24.736', '27.688', '29.819'],
  ['4.075', '4.660', '5.629', '6.571', '7.790', '21.064', '23.685', '26.119', '29.141', '31.319'],
  ['4.601', '5.229', '6.262', '7.261', '8.547', '22.307', '24.996', '27.488', '30.578', '32.801'],
  ['5.142', '5.812', '6.908', '7.962', '9.312', '23.542', '26.296', '28.845', '32.000', '34.267'],
  ['5.697', '6.408', '7.564', '8.672', '10.085', '24.769', '27.587', '30.191', '33.409', '35.718'],
  ['6.265', '7.015', '8.231', '9.390', '10.865', '25.989', '28.869', '31.526', '34.805', '37.156'],
  ['6.844', '7.633', '8.907', '10.117', '11.651', '27.204', '30.144', '32.852', '36.191', '38.582'],
  ['7.434', '8.260', '9.591', '10.851', '12.443', '28.412', '31.410', '34.170', '37.566', '39.997'],
  ['8.034', '8.897', '10.283', '11.591', '13.240', '29.615', '32.671', '35.479', '38.932', '41.401'],
  ['8.643', '9.542', '10.982', '12.338', '14.042', '30.813', '33.924', '36.781', '40.289', '42.796'],
  ['9.260', '10.196', '11.689', '13.091', '14.848', '32.007', '35.172', '38.076', '41.638', '44.181'],
  ['9.886', '10.856', '12.401', '13.848', '15.659', '33.196', '36.415', '39.364', '42.980', '45.558'],
  ['10.520', '11.524', '13.120', '14.611', '16.473', '34.382', '37.652', '40.646', '44.314', '46.928'],
  ['11.160', '12.198', '13.844', '15.379', '17.292', '35.563', '38.885', '41.923', '45.642', '48.290'],
  ['11.808', '12.879', '14.573', '16.151', '18.114', '36.741', '40.113', '43.194', '46.963', '49.645'],
  ['12.461', '13.565', '15.308', '16.928', '18.939', '37.916', '41.337', '44.461', '48.278', '50.993'],
  ['13.121', '14.256', '16.047', '17.708', '19.768', '39.088', '42.557', '45.722', '49.588', '52.336'],
  ['13.787', '14.953', '16.791', '18.493', '20.599', '40.256', '43.773', '46.979', '50.892', '53.672'],
];
/** Critical values for correlation coefficients (one-tailed). pmcc: 0.10, 0.05, 0.025, 0.01, 0.005; spearman: 0.05, 0.025, 0.01. */
export const CORR: { n: number; pmcc: string[]; spearman: string[] }[] = [
  { n: 4, pmcc: ['0.8000', '0.9000', '0.9500', '0.9800', '0.9900'], spearman: ['1.0000', '–', '–'] },
  { n: 5, pmcc: ['0.6870', '0.8054', '0.8783', '0.9343', '0.9587'], spearman: ['0.9000', '1.0000', '1.0000'] },
  { n: 6, pmcc: ['0.6084', '0.7293', '0.8114', '0.8822', '0.9172'], spearman: ['0.8286', '0.8857', '0.9429'] },
  { n: 7, pmcc: ['0.5509', '0.6694', '0.7545', '0.8329', '0.8745'], spearman: ['0.7143', '0.7857', '0.8929'] },
  { n: 8, pmcc: ['0.5067', '0.6215', '0.7067', '0.7887', '0.8343'], spearman: ['0.6429', '0.7381', '0.8333'] },
  { n: 9, pmcc: ['0.4716', '0.5822', '0.6664', '0.7498', '0.7977'], spearman: ['0.6000', '0.7000', '0.7833'] },
  { n: 10, pmcc: ['0.4428', '0.5494', '0.6319', '0.7155', '0.7646'], spearman: ['0.5636', '0.6485', '0.7455'] },
  { n: 11, pmcc: ['0.4187', '0.5214', '0.6021', '0.6851', '0.7348'], spearman: ['0.5364', '0.6182', '0.7091'] },
  { n: 12, pmcc: ['0.3981', '0.4973', '0.5760', '0.6581', '0.7079'], spearman: ['0.5035', '0.5874', '0.6783'] },
  { n: 13, pmcc: ['0.3802', '0.4762', '0.5529', '0.6339', '0.6835'], spearman: ['0.4835', '0.5604', '0.6484'] },
  { n: 14, pmcc: ['0.3646', '0.4575', '0.5324', '0.6120', '0.6614'], spearman: ['0.4637', '0.5385', '0.6264'] },
  { n: 15, pmcc: ['0.3507', '0.4409', '0.5140', '0.5923', '0.6411'], spearman: ['0.4464', '0.5214', '0.6036'] },
  { n: 16, pmcc: ['0.3383', '0.4259', '0.4973', '0.5742', '0.6226'], spearman: ['0.4294', '0.5029', '0.5824'] },
  { n: 17, pmcc: ['0.3271', '0.4124', '0.4821', '0.5577', '0.6055'], spearman: ['0.4142', '0.4877', '0.5662'] },
  { n: 18, pmcc: ['0.3170', '0.4000', '0.4683', '0.5425', '0.5897'], spearman: ['0.4014', '0.4716', '0.5501'] },
  { n: 19, pmcc: ['0.3077', '0.3887', '0.4555', '0.5285', '0.5751'], spearman: ['0.3912', '0.4596', '0.5351'] },
  { n: 20, pmcc: ['0.2992', '0.3783', '0.4438', '0.5155', '0.5614'], spearman: ['0.3805', '0.4466', '0.5218'] },
  { n: 21, pmcc: ['0.2914', '0.3687', '0.4329', '0.5034', '0.5487'], spearman: ['0.3701', '0.4364', '0.5091'] },
  { n: 22, pmcc: ['0.2841', '0.3598', '0.4227', '0.4921', '0.5368'], spearman: ['0.3608', '0.4252', '0.4975'] },
  { n: 23, pmcc: ['0.2774', '0.3515', '0.4133', '0.4815', '0.5256'], spearman: ['0.3528', '0.4160', '0.4862'] },
  { n: 24, pmcc: ['0.2711', '0.3438', '0.4044', '0.4716', '0.5151'], spearman: ['0.3443', '0.4070', '0.4757'] },
  { n: 25, pmcc: ['0.2653', '0.3365', '0.3961', '0.4622', '0.5052'], spearman: ['0.3369', '0.3977', '0.4662'] },
  { n: 26, pmcc: ['0.2598', '0.3297', '0.3882', '0.4534', '0.4958'], spearman: ['0.3306', '0.3901', '0.4571'] },
  { n: 27, pmcc: ['0.2546', '0.3233', '0.3809', '0.4451', '0.4869'], spearman: ['0.3242', '0.3828', '0.4487'] },
  { n: 28, pmcc: ['0.2497', '0.3172', '0.3739', '0.4372', '0.4785'], spearman: ['0.3180', '0.3755', '0.4401'] },
  { n: 29, pmcc: ['0.2451', '0.3115', '0.3673', '0.4297', '0.4705'], spearman: ['0.3118', '0.3685', '0.4325'] },
  { n: 30, pmcc: ['0.2407', '0.3061', '0.3610', '0.4226', '0.4629'], spearman: ['0.3063', '0.3624', '0.4251'] },
  { n: 40, pmcc: ['0.2070', '0.2638', '0.3120', '0.3665', '0.4026'], spearman: ['0.2640', '0.3128', '0.3681'] },
  { n: 50, pmcc: ['0.1843', '0.2353', '0.2787', '0.3281', '0.3610'], spearman: ['0.2353', '0.2791', '0.3293'] },
  { n: 60, pmcc: ['0.1678', '0.2144', '0.2542', '0.2997', '0.3301'], spearman: ['0.2144', '0.2545', '0.3005'] },
  { n: 70, pmcc: ['0.1550', '0.1982', '0.2352', '0.2776', '0.3060'], spearman: ['0.1982', '0.2354', '0.2782'] },
  { n: 80, pmcc: ['0.1448', '0.1852', '0.2199', '0.2597', '0.2864'], spearman: ['0.1852', '0.2201', '0.2602'] },
  { n: 90, pmcc: ['0.1364', '0.1745', '0.2072', '0.2449', '0.2702'], spearman: ['0.1745', '0.2074', '0.2453'] },
  { n: 100, pmcc: ['0.1292', '0.1654', '0.1966', '0.2324', '0.2565'], spearman: ['0.1654', '0.1967', '0.2327'] },
];
