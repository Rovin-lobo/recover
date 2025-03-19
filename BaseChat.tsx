import type { Message } from "ai";
import React, { type RefCallback, useState, useEffect } from "react";
import { ClientOnly } from "remix-utils/client-only";
import { Menu } from "~/components/sidebar/Menu.client";
import { IconButton } from "~/components/ui/IconButton";
import { Workbench } from "~/components/workbench/Workbench.client";
import { classNames } from "~/utils/classNames";
import { Messages } from "./Messages.client";
import { SendButton } from "./SendButton.client";

import styles from "./BaseChat.module.scss";

interface GitHubApiResponse {
  needsAuth: boolean;
  authUrl?: string;
  metadata?: {
    owner: string;
    repo: string;
    state?: string;
    isPrivate?: boolean;
  };
}

interface BaseChatProps {
  textareaRef?: React.RefObject<HTMLTextAreaElement> | undefined;
  messageRef?: RefCallback<HTMLDivElement> | undefined;
  scrollRef?: RefCallback<HTMLDivElement> | undefined;
  showChat?: boolean;
  chatStarted?: boolean;
  isStreaming?: boolean;
  messages?: Message[];
  enhancingPrompt?: boolean;
  promptEnhanced?: boolean;
  input?: string;
  handleStop?: () => void;
  sendMessage?: (event: React.UIEvent, messageInput?: string) => void;
  handleInputChange?: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  enhancePrompt?: () => void;
}

const EXAMPLE_PROMPTS = [
  { text: "Build a todo app in React using Tailwind" },
  { text: "Build a simple blog using Astro" },
  { text: "Create a cookie consent form using Material UI" },
  { text: "Make a space invaders game" },
  { text: "How do I center a div?" },
];

const TEXTAREA_MIN_HEIGHT = 76;

export const BaseChat = React.forwardRef<HTMLDivElement, BaseChatProps>(
  (
    {
      textareaRef,
      messageRef,
      scrollRef,
      showChat = true,
      chatStarted = false,
      isStreaming = false,
      enhancingPrompt = false,
      promptEnhanced = false,
      messages,
      input = "",
      sendMessage,
      handleInputChange,
      enhancePrompt,
      handleStop,
    },
    ref,
  ) => {
    const [showRepoModal, setShowRepoModal] = useState(false);
    const [repoFormData, setRepoFormData] = useState({
      url: "",
      branch: "",
      isPrivate: false,
      authToken: "",
    });
    const [urlError, setUrlError] = useState<string | null>(null);

    const validateGitHubUrl = (url: string): boolean => {
      // Allow both full URLs and shorthand format (user/repo)
      const fullUrlPattern =
        /^https?:\/\/(?:www\.)?github\.com\/[\w.-]+\/[\w.-]+$/;
      const shorthandPattern = /^[\w.-]+\/[\w.-]+$/;

      return fullUrlPattern.test(url) || shorthandPattern.test(url);
    };
    const [repoMetadata, setRepoMetadata] = useState<
      GitHubApiResponse["metadata"] | null
    >(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const TEXTAREA_MAX_HEIGHT = chatStarted ? 400 : 200;

    const handleRepoSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsSubmitting(true);
      setError(null);

      try {
        const response = await fetch("/api/github", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ url: repoFormData.url }),
        });

        const data = (await response.json()) as GitHubApiResponse;

        if (data.needsAuth && data.authUrl) {
          window.location.href = data.authUrl;
          return;
        }

        setShowRepoModal(false);

        if (data.metadata) {
          setRepoMetadata(data.metadata);
        }
      } catch (err) {
        setError("Failed to process repository");
      } finally {
        setIsSubmitting(false);
      }
    };

    useEffect(() => {
      const params = new URLSearchParams(window.location.search);
      const error = params.get("error");
      const success = params.get("success");

      if (error) {
        setError(
          error === "auth_failed"
            ? "GitHub authorization failed"
            : "Invalid request",
        );
      } else if (success) {
        setError(null);
        setShowRepoModal(false);
      }

      if (error || success) {
        const newUrl = window.location.pathname;
        window.history.replaceState({}, "", newUrl);
      }
    }, []);

    return (
      <div
        ref={ref}
        className={classNames(
          styles.BaseChat,
          "relative flex h-full w-full overflow-hidden bg-bolt-elements-background-depth-1",
        )}
        data-chat-visible={showChat}
      >
        <ClientOnly>{() => <Menu />}</ClientOnly>
        <div ref={scrollRef} className="flex overflow-y-auto w-full h-full">
          <div
            className={classNames(
              styles.Chat,
              "flex flex-col flex-grow min-w-[var(--chat-min-width)] h-full",
            )}
          >
            {!chatStarted && (
              <>
                <div
                  id="intro"
                  className="mt-[26vh] max-w-chat mx-auto relative"
                >
                  <button
                    onClick={() => setShowRepoModal(true)}
                    className="absolute -right-16 top-0 p-2 rounded-full hover:bg-bolt-elements-background-depth-2 text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary transition-theme"
                  >
                    <div className="i-ph:plus-circle text-2xl" />
                  </button>
                  <h1 className="text-5xl text-center font-bold text-bolt-elements-textPrimary mb-2">
                    Where ideas begin
                  </h1>
                  <p className="mb-4 text-center text-bolt-elements-textSecondary">
                    Bring ideas to life in seconds or get help on existing
                    projects.
                  </p>
                </div>
                {showRepoModal && (
                  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-bolt-elements-background-depth-1 rounded-lg shadow-lg w-full max-w-md mx-4">
                      <div className="flex justify-between items-center p-4 border-b border-bolt-elements-borderColor">
                        <h2 className="text-xl font-semibold text-bolt-elements-textPrimary">
                          Import Repository
                        </h2>
                        <button
                          onClick={() => setShowRepoModal(false)}
                          className="text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary"
                        >
                          <div className="i-ph:x text-xl" />
                        </button>
                      </div>
                      <form
                        className="p-4 space-y-4"
                        onSubmit={handleRepoSubmit}
                      >
                        <div>
                          <label className="block text-sm font-medium text-bolt-elements-textSecondary mb-1">
                            Repository URL
                          </label>
                          <input
                            type="text"
                            value={repoFormData.url}
                            onChange={(e) => {
                              const newUrl = e.target.value;
                              setRepoFormData((prev) => ({
                                ...prev,
                                url: newUrl,
                              }));

                              if (newUrl.trim() === "") {
                                setUrlError(null);
                              } else if (!validateGitHubUrl(newUrl)) {
                                setUrlError(
                                  "Please enter a valid GitHub repository URL",
                                );
                              } else {
                                setUrlError(null);
                              }
                            }}
                            placeholder="https://github.com/user/repo or user/repo"
                            className="w-full p-2 rounded-md bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary focus:outline-none focus:ring-2 focus:ring-bolt-elements-item-backgroundAccent"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-bolt-elements-textSecondary mb-1">
                            Branch (optional)
                          </label>
                          <input
                            type="text"
                            value={repoFormData.branch}
                            onChange={(e) =>
                              setRepoFormData((prev) => ({
                                ...prev,
                                branch: e.target.value,
                              }))
                            }
                            placeholder="main"
                            className="w-full p-2 rounded-md bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary focus:outline-none focus:ring-2 focus:ring-bolt-elements-item-backgroundAccent"
                          />
                        </div>
                        {(error || urlError) && (
                          <div className="text-red-500 text-sm">
                            {urlError || error}
                          </div>
                        )}
                        <div className="flex justify-end pt-4">
                          <button
                            type="submit"
                            disabled={
                              isSubmitting || !repoFormData.url || !!urlError
                            }
                            className={classNames(
                              "px-4 py-2 rounded-md transition-theme",
                              isSubmitting || !repoFormData.url
                                ? "bg-bolt-elements-background-depth-2 text-bolt-elements-textTertiary"
                                : "bg-bolt-elements-item-backgroundAccent text-bolt-elements-textPrimary hover:bg-opacity-90",
                            )}
                          >
                            {isSubmitting ? (
                              <div className="i-svg-spinners:90-ring-with-bg text-bolt-elements-loader-progress text-xl" />
                            ) : (
                              "Import Repository"
                            )}
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}
              </>
            )}
            <div
              className={classNames("pt-6 px-6", {
                "h-full flex flex-col": chatStarted,
              })}
            >
              <ClientOnly>
                {() => {
                  return chatStarted ? (
                    <Messages
                      ref={messageRef}
                      className="flex flex-col w-full flex-1 max-w-chat px-4 pb-6 mx-auto z-1"
                      messages={messages}
                      isStreaming={isStreaming}
                    />
                  ) : null;
                }}
              </ClientOnly>
              <div
                className={classNames(
                  "relative w-full max-w-chat mx-auto z-prompt",
                  {
                    "sticky bottom-0": chatStarted,
                  },
                )}
              >
                <div
                  className={classNames(
                    "shadow-sm border border-bolt-elements-borderColor bg-bolt-elements-prompt-background backdrop-filter backdrop-blur-[8px] rounded-lg overflow-hidden",
                  )}
                >
                  <textarea
                    ref={textareaRef}
                    className={`w-full pl-4 pt-4 pr-16 focus:outline-none resize-none text-md text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary bg-transparent`}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        if (event.shiftKey) {
                          return;
                        }

                        event.preventDefault();
                        sendMessage?.(event);
                      }
                    }}
                    value={input}
                    onChange={(event) => {
                      handleInputChange?.(event);
                    }}
                    style={{
                      minHeight: TEXTAREA_MIN_HEIGHT,
                      maxHeight: TEXTAREA_MAX_HEIGHT,
                    }}
                    placeholder="How can Bolt help you today?"
                    translate="no"
                  />
                  <ClientOnly>
                    {() => (
                      <SendButton
                        show={input.length > 0 || isStreaming}
                        isStreaming={isStreaming}
                        onClick={(event) => {
                          if (isStreaming) {
                            handleStop?.();
                            return;
                          }

                          sendMessage?.(event);
                        }}
                      />
                    )}
                  </ClientOnly>
                  <div className="flex justify-between text-sm p-4 pt-2">
                    <div className="flex gap-1 items-center">
                      <IconButton
                        title="Enhance prompt"
                        disabled={input.length === 0 || enhancingPrompt}
                        className={classNames({
                          "opacity-100!": enhancingPrompt,
                          "text-bolt-elements-item-contentAccent! pr-1.5 enabled:hover:bg-bolt-elements-item-backgroundAccent!":
                            promptEnhanced,
                        })}
                        onClick={() => enhancePrompt?.()}
                      >
                        {enhancingPrompt ? (
                          <>
                            <div className="i-svg-spinners:90-ring-with-bg text-bolt-elements-loader-progress text-xl" />
                            <div className="ml-1.5">Enhancing prompt...</div>
                          </>
                        ) : (
                          <>
                            <div className="i-bolt:stars text-xl" />
                            {promptEnhanced && (
                              <div className="ml-1.5">Prompt enhanced</div>
                            )}
                          </>
                        )}
                      </IconButton>
                    </div>
                    {input.length > 3 ? (
                      <div className="text-xs text-bolt-elements-textTertiary">
                        Use <kbd className="kdb">Shift</kbd> +{" "}
                        <kbd className="kdb">Return</kbd> for a new line
                      </div>
                    ) : null}
                  </div>
                </div>
                <div className="bg-bolt-elements-background-depth-1 pb-6" />
              </div>
            </div>
            {!chatStarted && (
              <div
                id="examples"
                className="relative w-full max-w-xl mx-auto mt-8 flex justify-center"
              >
                <div className="flex flex-col space-y-2 [mask-image:linear-gradient(to_bottom,black_0%,transparent_180%)] hover:[mask-image:none]">
                  {EXAMPLE_PROMPTS.map((examplePrompt, index) => (
                    <button
                      key={index}
                      onClick={(event) => {
                        sendMessage?.(event, examplePrompt.text);
                      }}
                      className="group flex items-center w-full gap-2 justify-center bg-transparent text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary transition-theme"
                    >
                      {examplePrompt.text}
                      <div className="i-ph:arrow-bend-down-left" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <ClientOnly>
            {() => (
              <Workbench chatStarted={chatStarted} isStreaming={isStreaming} />
            )}
          </ClientOnly>
        </div>
      </div>
    );
  },
);

BaseChat.displayName = "BaseChat";