import DevHero from '@/components/dev/DevHero';
import DesignToCode from '@/components/dev/DesignToCode';
import DevServices from '@/components/dev/DevServices';
import DevWork from '@/components/dev/DevWork';
import DevProcess from '@/components/dev/DevProcess';
import DevStack from '@/components/dev/DevStack';
import DevCase from '@/components/dev/DevCase';
import DevPackages from '@/components/dev/DevPackages';

// data-site-mode="dev" switches the site accent to green (see globals.css)
export default function DevHomePage() {
  return (
    <div data-site-mode="dev">
      <DevHero />
      <DesignToCode />
      <DevWork />
      <DevServices />
      <DevProcess />
      <DevStack />
      <DevCase />
      <DevPackages />
    </div>
  );
}
