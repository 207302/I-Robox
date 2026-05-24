import { ArrowLeftIcon } from "@/assets/icons";
import Image from "next/image";
import Link from "next/link";

export default function NotFound() {
  return (
    <section className="flex items-center justify-center h-screen pb-20 overflow-hidden bg-gray-2">
      <div className="w-full px-4 mx-auto max-w-7xl sm:px-8 xl:px-0">
        <div className="px-4 py-10 bg-white rounded-xl shadow-1 sm:py-15 lg:py-20 xl:py-25">
          <div className="text-center">
            <Image
              src="/images/404.svg"
              alt="404"
              className="w-1/2 mx-auto mb-8 sm:w-auto"
              width={288}
              height={190}
              priority
              fetchPriority="high"
              sizes="(max-width: 640px) 50vw, 288px"
            />

            <h2 className="mb-3 text-xl font-medium text-dark sm:text-2xl">
              Sorry, the page can’t be found
            </h2>

            <p className="max-w-[410px] w-full mx-auto mb-7.5">
              The page you were looking for appears to have been moved, deleted
              or does not exist.
            </p>

            <Link
              href="/"
              prefetch={false}
              className="inline-flex items-center gap-2 px-6 py-3 font-medium text-white duration-200 ease-out rounded-md bg-blue hover:bg-blue-dark"
            >
              <ArrowLeftIcon />
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
