import { SearchForm } from "../components/SearchForm.jsx";
import { InfoGrid } from "../components/InfoGrid.jsx";
import { Search, Ticket, Shield, Clock } from "lucide-react";
import styles from "./HomePage.module.css";

const features = [
  {
    icon: <Search size={22} />,
    title: "Зручний пошук",
    text: "Знайдіть рейс за станціями та датою за кілька секунд."
  },
  {
    icon: <Ticket size={22} />,
    title: "Бронювання та оплата",
    text: "Оберіть місце, оформіть бронь та оплатіть квиток онлайн."
  },
  {
    icon: <Shield size={22} />,
    title: "Ролі та доступ",
    text: "Окремі інтерфейси для пасажирів, касирів та адміністраторів."
  },
  {
    icon: <Clock size={22} />,
    title: "Керування поїздками",
    text: "Переглядайте активні квитки та оформлюйте повернення в особистому кабінеті."
  }
];

export function HomePage() {
  return (
    <div className={styles.home}>
      <section className={styles.hero}>
        <div className={styles.heroText}>
          <span className={styles.heroKicker}>Бронювання залізничних квитків</span>
          <h1 className={styles.heroTitle}>Подорожуйте потягом із комфортом</h1>
          <p className={styles.heroSubtitle}>
            Пошук рейсів, вибір місця та оформлення квитків в одному місці.
          </p>
        </div>
        <SearchForm variant="hero" />
      </section>

      <section className={styles.features}>
        <h2 className={styles.featuresTitle}>Чому зручно бронювати у нас</h2>
        <InfoGrid items={features} />
      </section>
    </div>
  );
}
