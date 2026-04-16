import Image from "next/image";
import Link from "next/link";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";

type HomePageProps = {
  searchParams?: Promise<{
    flow?: "join";
    code?: string;
  }>;
};

function buildAuthHref(mode: "login" | "register", inviteCode: string) {
  if (!inviteCode) {
    return mode === "register" ? "/login?flow=create" : "/login";
  }

  return mode === "register"
    ? `/login?flow=join&code=${encodeURIComponent(inviteCode)}`
    : `/login?flow=join&code=${encodeURIComponent(inviteCode)}`;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const inviteCode = params?.code?.trim() ?? "";
  const registerHref = buildAuthHref("register", inviteCode);
  const loginHref = buildAuthHref("login", inviteCode);
  const joinFloorHref = inviteCode
    ? loginHref
    : "/login?flow=join";

  return (
    <main>
      <section
        id="landing-section-one"
        className="landing-hero"
        aria-label="Imagen principal de Convive"
      >
        <div className="landing-hero__grid">
          <div className="landing-hero__top-actions">
            <Link href={registerHref} className="convive-button">
              Registrarse
            </Link>
            <Link href={loginHref} className="convive-button">
              Iniciar sesión
            </Link>
          </div>

          <Card className="landing-hero__bottom-card">
            <div className="landing-hero__card-content">
              <div className="landing-hero__card-grid">
                <a
                  href="#landing-section-two"
                  className="landing-hero__card-button landing-hero__card-link"
                >
                  <span className="landing-hero__card-label">3</span>
                  <span className="landing-hero__card-line" />
                </a>

                <Button className="landing-hero__card-button landing-hero__card-button--active">
                  <span className="landing-hero__card-label">A</span>
                  <span className="landing-hero__card-line" />
                </Button>

                <a
                  href="#landing-section-four"
                  className="landing-hero__card-button landing-hero__card-link"
                >
                  <span className="landing-hero__card-label">1</span>
                  <span className="landing-hero__card-line" />
                </a>

                <a
                  href="#landing-section-three"
                  className="landing-hero__card-button landing-hero__card-link"
                >
                  <span className="landing-hero__card-label">2</span>
                  <span className="landing-hero__card-line" />
                </a>
              </div>

              <a
                href="#landing-section-five"
                className="landing-hero__card-button landing-hero__card-button--bottom landing-hero__card-link"
              >
                <span className="landing-hero__card-label">PB</span>
                <span className="landing-hero__card-line" />
              </a>
            </div>
          </Card>

          <div className="landing-hero__content">
            <div className="landing-hero__brandline">
              <div className="landing-hero__brandline-top">
                <Image
                  src="/Logoconvive.png"
                  alt="Logo Convive"
                  width={600}
                  height={166}
                  className="landing-hero__logo"
                  priority
                />
                <span className="landing-hero__word">sin</span>
              </div>
              <span className="landing-hero__word">dramas</span>
            </div>

            <p className="landing-hero__text">
              Convive organiza los gastos, facturas y tareas de tu piso compartido
              para que lo único que tengas que hacer sea convivir sin dramas
            </p>

            <Link
              href={joinFloorHref}
              className="convive-button landing-hero__button"
            >
              Unirse a un piso
            </Link>
          </div>
        </div>
      </section>

      <section
        className="landing-section-two"
        aria-label="Segunda sección de Convive"
      >
        <div id="landing-section-two" className="landing-anchor" aria-hidden="true" />
        <div className="landing-section-two__grid">
          <h2 className="landing-section-two__title">
            Compartir piso puede ser todo un reto
          </h2>
          <p className="landing-section-two__text">
            Convive integra en una sola plataforma todo lo que necesita un piso
            compartido. Su inteligencia artificial automatiza los procesos más
            tediosos y su diseño está orientado a la convivencia en su totalidad.
          </p>
          <Link
            href={registerHref}
            className="convive-button landing-section-two__button"
          >
            Registrarse
          </Link>
        </div>

        <Card className="landing-hero__bottom-card landing-section-two__bottom-card">
          <div className="landing-hero__card-content">
            <div className="landing-hero__card-grid">
              <Button className="landing-hero__card-button landing-hero__card-button--active">
                <span className="landing-hero__card-label">3</span>
                <span className="landing-hero__card-line" />
              </Button>

              <a
                href="#landing-section-one"
                className="landing-hero__card-button landing-hero__card-link"
              >
                <span className="landing-hero__card-label">A</span>
                <span className="landing-hero__card-line" />
              </a>

              <a
                href="#landing-section-four"
                className="landing-hero__card-button landing-hero__card-link"
              >
                <span className="landing-hero__card-label">1</span>
                <span className="landing-hero__card-line" />
              </a>

              <a
                href="#landing-section-three"
                className="landing-hero__card-button landing-hero__card-link"
              >
                <span className="landing-hero__card-label">2</span>
                <span className="landing-hero__card-line" />
              </a>
            </div>

            <a
              href="#landing-section-five"
              className="landing-hero__card-button landing-hero__card-button--bottom landing-hero__card-link"
            >
              <span className="landing-hero__card-label">PB</span>
              <span className="landing-hero__card-line" />
            </a>
          </div>
        </Card>
      </section>

      <section
        id="landing-section-three"
        className="landing-section-three"
        aria-label="Tercera sección de Convive"
      >
        <div className="landing-section-three__grid">
          <div className="landing-section-three__stack-main">
            <div className="landing-section-three__item landing-section-three__item--main-1">
              <div className="landing-section-three__badge">1</div>
              <p className="landing-section-three__badge-text">
                Registro siempre
                <br />
                actualizado
              </p>
            </div>

            <div className="landing-section-three__item landing-section-three__item--main-2">
              <div className="landing-section-three__badge">2</div>
              <p className="landing-section-three__badge-text">
                División justa y
                <br />
                automática
              </p>
            </div>

            <div className="landing-section-three__item landing-section-three__item--main-3">
              <div className="landing-section-three__badge">3</div>
              <p className="landing-section-three__badge-text">
                Comunicación sin
                <br />
                fricciones
              </p>
            </div>
          </div>

          <div className="landing-section-three__stack-copy">
            <div className="landing-section-three__item landing-section-three__item--copy-1">
              <div className="landing-section-three__badge">4</div>
              <p className="landing-section-three__badge-text">
                Registro siempre
                <br />
                actualizado
              </p>
            </div>

            <div className="landing-section-three__item landing-section-three__item--copy-2">
              <div className="landing-section-three__badge">5</div>
              <p className="landing-section-three__badge-text">
                Comunicación
                <br />
                sin fricciones
              </p>
            </div>
          </div>
        </div>

        <Card className="landing-hero__bottom-card landing-section-three__bottom-card">
          <div className="landing-hero__card-content">
            <div className="landing-hero__card-grid">
              <a
                href="#landing-section-two"
                className="landing-hero__card-button landing-hero__card-link"
              >
                <span className="landing-hero__card-label">3</span>
                <span className="landing-hero__card-line" />
              </a>

              <a
                href="#landing-section-one"
                className="landing-hero__card-button landing-hero__card-link"
              >
                <span className="landing-hero__card-label">A</span>
                <span className="landing-hero__card-line" />
              </a>

              <a
                href="#landing-section-four"
                className="landing-hero__card-button landing-hero__card-link"
              >
                <span className="landing-hero__card-label">1</span>
                <span className="landing-hero__card-line" />
              </a>

              <Button className="landing-hero__card-button landing-hero__card-button--active">
                <span className="landing-hero__card-label">2</span>
                <span className="landing-hero__card-line" />
              </Button>
            </div>

            <a
              href="#landing-section-five"
              className="landing-hero__card-button landing-hero__card-button--bottom landing-hero__card-link"
            >
              <span className="landing-hero__card-label">PB</span>
              <span className="landing-hero__card-line" />
            </a>
          </div>
        </Card>
      </section>

      <section
        className="landing-section-four"
        aria-label="Cuarta sección de Convive"
      >
        <div id="landing-section-four" className="landing-anchor" aria-hidden="true" />
        <div className="landing-section-two__grid landing-section-four__grid">
          <h2 className="landing-section-two__title">
            Todo lo que necesita tu piso, en un solo lugar
          </h2>
          <p className="landing-section-two__text">
            Gestionar los gastos comunes, dividir facturas y mantener un registro
            claro de las deudas puede ser más complejo de lo que parece. Convive
            nace para eliminar esa carga.
          </p>
          <Link
            href={loginHref}
            className="convive-button landing-section-two__button"
          >
            Unirme a un piso
          </Link>
        </div>

        <Card className="landing-hero__bottom-card landing-section-four__bottom-card">
          <div className="landing-hero__card-content">
            <div className="landing-hero__card-grid">
              <a
                href="#landing-section-two"
                className="landing-hero__card-button landing-hero__card-link"
              >
                <span className="landing-hero__card-label">3</span>
                <span className="landing-hero__card-line" />
              </a>

              <a
                href="#landing-section-one"
                className="landing-hero__card-button landing-hero__card-link"
              >
                <span className="landing-hero__card-label">A</span>
                <span className="landing-hero__card-line" />
              </a>

              <Button className="landing-hero__card-button landing-hero__card-button--active">
                <span className="landing-hero__card-label">1</span>
                <span className="landing-hero__card-line" />
              </Button>

              <a
                href="#landing-section-three"
                className="landing-hero__card-button landing-hero__card-link"
              >
                <span className="landing-hero__card-label">2</span>
                <span className="landing-hero__card-line" />
              </a>
            </div>

            <a
              href="#landing-section-five"
              className="landing-hero__card-button landing-hero__card-button--bottom landing-hero__card-link"
            >
              <span className="landing-hero__card-label">PB</span>
              <span className="landing-hero__card-line" />
            </a>
          </div>
        </Card>
      </section>

      <section
        className="landing-section-five"
        aria-label="Quinta sección de Convive"
      >
        <div id="landing-section-five" className="landing-anchor" aria-hidden="true" />
        <div className="landing-section-five__grid">
          <div className="landing-section-five__content">
            <h2 className="landing-section-five__title">
              EMPIEZA A CONVIVIR MEJOR
            </h2>
            <div className="landing-section-five__actions">
              <Link href={registerHref} className="convive-button">
                Registrarse
              </Link>
              <Link href={loginHref} className="convive-button">
                Iniciar sesión
              </Link>
            </div>
          </div>
        </div>

        <Card className="landing-hero__bottom-card landing-section-five__bottom-card">
          <div className="landing-hero__card-content">
            <div className="landing-hero__card-grid">
              <a
                href="#landing-section-two"
                className="landing-hero__card-button landing-hero__card-link"
              >
                <span className="landing-hero__card-label">3</span>
                <span className="landing-hero__card-line" />
              </a>

              <a
                href="#landing-section-one"
                className="landing-hero__card-button landing-hero__card-link"
              >
                <span className="landing-hero__card-label">A</span>
                <span className="landing-hero__card-line" />
              </a>

              <a
                href="#landing-section-four"
                className="landing-hero__card-button landing-hero__card-link"
              >
                <span className="landing-hero__card-label">1</span>
                <span className="landing-hero__card-line" />
              </a>

              <a
                href="#landing-section-three"
                className="landing-hero__card-button landing-hero__card-link"
              >
                <span className="landing-hero__card-label">2</span>
                <span className="landing-hero__card-line" />
              </a>
            </div>

            <Button className="landing-hero__card-button landing-hero__card-button--active landing-hero__card-button--bottom">
              <span className="landing-hero__card-label">PB</span>
              <span className="landing-hero__card-line" />
            </Button>
          </div>
        </Card>
      </section>
    </main>
  );
}


